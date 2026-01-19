import OpenAI from "openai";

const GPT_MODEL = "gpt-5";

// Lazy initialization to avoid requiring API key at build time
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

interface LanguageInfo {
  name: string;
  codeBlockLang: string;
}

const LANGUAGE_MAP: Record<string, LanguageInfo> = {
  ".java": { name: "Java", codeBlockLang: "java" },
  ".py": { name: "Python", codeBlockLang: "python" },
  ".js": { name: "JavaScript", codeBlockLang: "javascript" },
  ".ts": { name: "TypeScript", codeBlockLang: "typescript" },
  ".jsx": { name: "JavaScript (React)", codeBlockLang: "jsx" },
  ".tsx": { name: "TypeScript (React)", codeBlockLang: "tsx" },
  ".c": { name: "C", codeBlockLang: "c" },
  ".cpp": { name: "C++", codeBlockLang: "cpp" },
  ".cc": { name: "C++", codeBlockLang: "cpp" },
  ".h": { name: "C/C++ Header", codeBlockLang: "c" },
  ".hpp": { name: "C++ Header", codeBlockLang: "cpp" },
  ".cs": { name: "C#", codeBlockLang: "csharp" },
  ".go": { name: "Go", codeBlockLang: "go" },
  ".rs": { name: "Rust", codeBlockLang: "rust" },
  ".rb": { name: "Ruby", codeBlockLang: "ruby" },
  ".php": { name: "PHP", codeBlockLang: "php" },
  ".swift": { name: "Swift", codeBlockLang: "swift" },
  ".kt": { name: "Kotlin", codeBlockLang: "kotlin" },
  ".scala": { name: "Scala", codeBlockLang: "scala" },
  ".r": { name: "R", codeBlockLang: "r" },
  ".m": { name: "MATLAB/Objective-C", codeBlockLang: "matlab" },
  ".sql": { name: "SQL", codeBlockLang: "sql" },
  ".sh": { name: "Shell/Bash", codeBlockLang: "bash" },
  ".bash": { name: "Bash", codeBlockLang: "bash" },
};

function detectLanguage(filename: string | null): LanguageInfo {
  if (!filename) {
    return { name: "programming", codeBlockLang: "" };
  }
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return LANGUAGE_MAP[ext] || { name: "programming", codeBlockLang: "" };
}

export function isJavaFile(filename: string | null): boolean {
  if (!filename) return false;
  return filename.toLowerCase().endsWith(".java");
}

function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [openai] [${level.toUpperCase()}]`;
  if (data) {
    console[level](`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console[level](`${prefix} ${message}`);
  }
}

export interface CodeIssue {
  type: "error" | "warning" | "suggestion";
  line?: number;
  description: string;
  severity: "critical" | "major" | "minor";
}

export interface DiscussionPoint {
  topic: string;
  question: string;
  context: string;
  expectedAnswer?: string;
  followUpQuestions?: string[];
}

export interface ReviewResult {
  feedback: string;
  issues: CodeIssue[];
  discussionPlan: DiscussionPoint[];
  rawResponse: string;
}

function tryRepairJson(truncated: string): Record<string, unknown> | null {
  // Try progressively more aggressive repairs
  let repaired = truncated.trim();

  // Remove trailing incomplete string if present
  const lastQuote = repaired.lastIndexOf('"');
  const lastColon = repaired.lastIndexOf(':');
  if (lastColon > lastQuote) {
    // We have an incomplete value after a colon, truncate to before it
    repaired = repaired.substring(0, lastColon);
    // Remove the key as well
    const keyStart = repaired.lastIndexOf('"', repaired.lastIndexOf('"') - 1);
    if (keyStart > 0) {
      repaired = repaired.substring(0, keyStart);
    }
  }

  // Remove trailing comma
  repaired = repaired.replace(/,\s*$/, '');

  // Count unclosed brackets and braces
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;

  for (const char of repaired) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') braces++;
    else if (char === '}') braces--;
    else if (char === '[') brackets++;
    else if (char === ']') brackets--;
  }

  // Close unclosed strings (if we're in a string)
  if (inString) {
    repaired += '"';
  }

  // Close brackets and braces
  repaired += ']'.repeat(Math.max(0, brackets));
  repaired += '}'.repeat(Math.max(0, braces));

  try {
    return JSON.parse(repaired);
  } catch {
    // Try one more time: strip everything after the last complete array/object
    const lastCloseBracket = truncated.lastIndexOf(']');
    const lastCloseBrace = truncated.lastIndexOf('}');
    const lastClose = Math.max(lastCloseBracket, lastCloseBrace);

    if (lastClose > 0) {
      const stripped = truncated.substring(0, lastClose + 1);
      // Recount and close
      braces = 0;
      brackets = 0;
      inString = false;
      escaped = false;

      for (const char of stripped) {
        if (escaped) { escaped = false; continue; }
        if (char === '\\' && inString) { escaped = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (char === '{') braces++;
        else if (char === '}') braces--;
        else if (char === '[') brackets++;
        else if (char === ']') brackets--;
      }

      let final = stripped;
      final += ']'.repeat(Math.max(0, brackets));
      final += '}'.repeat(Math.max(0, braces));

      try {
        return JSON.parse(final);
      } catch {
        return null;
      }
    }

    return null;
  }
}

function buildSystemPrompt(language: LanguageInfo): string {
  return `You are an expert programming instructor at Stockholm University reviewing student code submissions in ${language.name}.

Your task is to:
1. Analyze the code for correctness, style, best practices, and potential issues
2. Give constructive feedback appropriate to the ${language.name} language
3. Identify specific issues with their severity
4. Create a discussion plan for an oral examination about the code

Respond ONLY with valid JSON in this exact format:
{
  "feedback": "<overall feedback string>",
  "issues": [
    {
      "type": "<error|warning|suggestion>",
      "line": <line number or null>,
      "description": "<description>",
      "severity": "<critical|major|minor>"
    }
  ],
  "discussionPlan": [
    {
      "topic": "<topic name>",
      "question": "<question to ask the student>",
      "context": "<why this question is relevant>",
      "expectedAnswer": "<what a good answer would include>",
      "followUpQuestions": ["<follow-up 1>", "<follow-up 2>"]
    }
  ]
}

Guidelines for discussion plan:
- Focus on understanding, not memorization
- Ask about design decisions and trade-offs
- Include questions about potential improvements
- Test understanding of ${language.name} concepts and idioms used
- Keep questions conversational for voice interaction
- Aim for 3-5 discussion points covering different aspects of the code
- Apply ${language.name} naming conventions and best practices when reviewing`;
}

function buildUserPrompt(code: string, filename: string | null, customPrompt: string | null, language: LanguageInfo): string {
  let prompt = "";

  if (customPrompt) {
    prompt += `Assignment-specific review instructions:\n${customPrompt}\n\n`;
  }

  prompt += `Please review the following ${language.name} code`;
  if (filename) {
    prompt += ` (${filename})`;
  }
  const codeBlock = language.codeBlockLang || "";
  prompt += `:\n\n\`\`\`${codeBlock}\n${code}\n\`\`\``;

  return prompt;
}

export async function reviewCode(
  code: string,
  filename: string | null,
  customPrompt: string | null
): Promise<ReviewResult> {
  const language = detectLanguage(filename);
  const systemPrompt = buildSystemPrompt(language);
  const userPrompt = buildUserPrompt(code, filename, customPrompt, language);

  log('info', `Calling OpenAI API`, { model: GPT_MODEL, filename, language: language.name, codeLength: code.length, hasCustomPrompt: !!customPrompt });

  let response;
  try {
    response = await getOpenAI().chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 16384,
    });
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    log('error', `OpenAI API call failed`, {
      error: err.message,
      status: err.status,
      code: err.code,
      stack: err.stack,
    });
    throw error;
  }

  log('info', `OpenAI API response received`, {
    model: response.model,
    finishReason: response.choices[0]?.finish_reason,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
    totalTokens: response.usage?.total_tokens,
  });

  const finishReason = response.choices[0]?.finish_reason;
  const rawResponse = response.choices[0]?.message?.content;
  if (!rawResponse) {
    log('error', `No content in OpenAI response`, { choices: response.choices, finishReason });
    throw new Error("No response from GPT");
  }

  const wasTruncated = finishReason === "length";
  if (wasTruncated) {
    log('warn', `Response was truncated, attempting to parse partial content`, {
      completionTokens: response.usage?.completion_tokens,
      contentLength: rawResponse.length,
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(rawResponse);
  } catch (parseError) {
    if (wasTruncated) {
      log('warn', `Attempting to repair truncated JSON`);
      parsed = tryRepairJson(rawResponse);
      if (!parsed) {
        log('error', `Failed to repair truncated JSON`, {
          error: (parseError as Error).message,
          rawResponse: rawResponse.substring(0, 500),
        });
        throw new Error(`GPT response was truncated and could not be repaired`);
      }
      log('info', `Successfully repaired truncated JSON`);
    } else {
      log('error', `Failed to parse OpenAI response as JSON`, {
        error: (parseError as Error).message,
        rawResponse: rawResponse.substring(0, 500),
      });
      throw new Error(`Failed to parse GPT response: ${(parseError as Error).message}`);
    }
  }

  log('info', `Response parsed successfully`, { issueCount: parsed.issues?.length, discussionPointCount: parsed.discussionPlan?.length });

  return {
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
    issues: Array.isArray(parsed.issues) ? parsed.issues.map(validateIssue) : [],
    discussionPlan: Array.isArray(parsed.discussionPlan) ? parsed.discussionPlan.map(validateDiscussionPoint) : [],
    rawResponse,
  };
}

function validateIssue(issue: unknown): CodeIssue {
  const obj = issue as Record<string, unknown>;
  return {
    type: ["error", "warning", "suggestion"].includes(obj.type as string)
      ? (obj.type as "error" | "warning" | "suggestion")
      : "warning",
    line: typeof obj.line === "number" ? obj.line : undefined,
    description: typeof obj.description === "string" ? obj.description : "No description",
    severity: ["critical", "major", "minor"].includes(obj.severity as string)
      ? (obj.severity as "critical" | "major" | "minor")
      : "minor",
  };
}

function validateDiscussionPoint(point: unknown): DiscussionPoint {
  const obj = point as Record<string, unknown>;
  return {
    topic: typeof obj.topic === "string" ? obj.topic : "General",
    question: typeof obj.question === "string" ? obj.question : "",
    context: typeof obj.context === "string" ? obj.context : "",
    expectedAnswer: typeof obj.expectedAnswer === "string" ? obj.expectedAnswer : undefined,
    followUpQuestions: Array.isArray(obj.followUpQuestions)
      ? obj.followUpQuestions.filter((q): q is string => typeof q === "string")
      : undefined,
  };
}

export function getCondensedDiscussionPlan(discussionPlan: DiscussionPoint[]): string {
  if (discussionPlan.length === 0) {
    return "No specific discussion points. Ask general questions about the student's understanding.";
  }

  return discussionPlan
    .map((point, index) => {
      let text = `${index + 1}. ${point.topic}\n   Question: ${point.question}`;
      if (point.followUpQuestions && point.followUpQuestions.length > 0) {
        text += `\n   Follow-ups: ${point.followUpQuestions.join("; ")}`;
      }
      return text;
    })
    .join("\n\n");
}

// Grading types and functions
export type GradingVariation = 'strict' | 'balanced' | 'generous';

export interface TranscriptGradeResult {
  score: number;
  reasoning: string;
  topicsCovered: string[];
  topicsMissed: string[];
  redFlags: string[];
}

const GRADING_VARIATION_PROMPTS: Record<GradingVariation, string> = {
  strict: `You are a STRICT academic examiner. Be rigorous in your assessment.
- Penalize unclear or incomplete explanations
- Require precise terminology and accurate descriptions
- Deduct points for hesitation or uncertainty about their own code
- A passing score requires demonstrating clear understanding`,

  balanced: `You are a BALANCED academic examiner. Be fair and thorough.
- Evaluate based on overall understanding demonstrated
- Consider both correctness and clarity of explanations
- Note both strengths and weaknesses
- Give credit for partial understanding when appropriate`,

  generous: `You are a SUPPORTIVE academic examiner. Give benefit of the doubt.
- Focus on core understanding rather than perfect articulation
- Account for nervousness in oral examination settings
- Credit attempts to explain even if not perfectly worded
- Prioritize whether the student understands the concepts`,
};

function buildGradingSystemPrompt(variation: GradingVariation, language: 'en' | 'sv'): string {
  const variationInstructions = GRADING_VARIATION_PROMPTS[variation];
  const languageNote = language === 'sv'
    ? 'The transcript is in Swedish. Evaluate the content, not the language quality.'
    : 'The transcript is in English.';

  return `${variationInstructions}

${languageNote}

You are grading a student's oral examination based on comparing:
1. The DISCUSSION PLAN (what topics/questions should be covered)
2. The TRANSCRIPT (what the student actually said)

Your task:
- Compare what was asked vs what was answered
- Evaluate depth of understanding demonstrated
- Check if the student can explain their own code
- Note any concerning patterns (reading from notes, vague answers, inability to answer follow-ups)

Respond ONLY with valid JSON:
{
  "score": <integer 0-100>,
  "reasoning": "<2-3 sentences explaining the score>",
  "topicsCovered": ["<topic 1>", "<topic 2>"],
  "topicsMissed": ["<missed topic 1>"],
  "redFlags": ["<concern 1>"]
}

Scoring guide:
- 90-100: Excellent understanding, clear explanations, handles follow-ups well
- 75-89: Good understanding, minor gaps or unclear points
- 60-74: Adequate understanding, some significant gaps
- 40-59: Partial understanding, multiple concerning gaps
- 0-39: Poor understanding, unable to explain core concepts`;
}

function buildGradingUserPrompt(
  discussionPlan: DiscussionPoint[],
  transcript: string
): string {
  const planText = discussionPlan.length > 0
    ? discussionPlan.map((p, i) =>
        `${i + 1}. Topic: ${p.topic}\n   Question: ${p.question}\n   Expected: ${p.expectedAnswer || 'N/A'}`
      ).join('\n\n')
    : 'No specific discussion plan available.';

  return `## DISCUSSION PLAN (what should be covered)

${planText}

## TRANSCRIPT (what the student said)

${transcript}

Please grade this oral examination.`;
}

export async function gradeTranscript(
  discussionPlan: DiscussionPoint[],
  transcript: string,
  language: 'en' | 'sv',
  variation: GradingVariation
): Promise<TranscriptGradeResult> {
  const systemPrompt = buildGradingSystemPrompt(variation, language);
  const userPrompt = buildGradingUserPrompt(discussionPlan, transcript);

  log('info', `Grading transcript with variation: ${variation}`, {
    model: GPT_MODEL,
    variation,
    language,
    transcriptLength: transcript.length,
    discussionPointCount: discussionPlan.length,
  });

  let response;
  try {
    response = await getOpenAI().chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });
  } catch (error) {
    const err = error as Error & { status?: number; code?: string };
    log('error', `OpenAI API grading call failed`, {
      error: err.message,
      status: err.status,
      code: err.code,
      variation,
    });
    throw error;
  }

  log('info', `Grading response received`, {
    model: response.model,
    variation,
    finishReason: response.choices[0]?.finish_reason,
    promptTokens: response.usage?.prompt_tokens,
    completionTokens: response.usage?.completion_tokens,
  });

  const rawResponse = response.choices[0]?.message?.content;
  if (!rawResponse) {
    throw new Error("No response from GPT for grading");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawResponse);
  } catch (parseError) {
    log('error', `Failed to parse grading response`, {
      error: (parseError as Error).message,
      rawResponse: rawResponse.substring(0, 500),
      variation,
    });
    throw new Error(`Failed to parse GPT grading response: ${(parseError as Error).message}`);
  }

  return {
    score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    topicsCovered: Array.isArray(parsed.topicsCovered) ? parsed.topicsCovered.filter((t: unknown): t is string => typeof t === 'string') : [],
    topicsMissed: Array.isArray(parsed.topicsMissed) ? parsed.topicsMissed.filter((t: unknown): t is string => typeof t === 'string') : [],
    redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.filter((f: unknown): f is string => typeof f === 'string') : [],
  };
}
