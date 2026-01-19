import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getDb } from '@/lib/db';
import OpenAI from 'openai';

const HIGHLIGHT_MODEL = 'gpt-5-nano';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

interface HighlightRequest {
  recentTranscript: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: seminarId } = await params;
  const body: HighlightRequest = await request.json();

  // Get the code for this seminar
  const sql = getDb();
  const data = await sql`
    SELECT sub.file_content, sub.filename
    FROM seminars s
    JOIN submissions sub ON s.submission_id = sub.id
    WHERE s.id = ${seminarId}
  `;

  if (data.length === 0 || !data[0].file_content) {
    return NextResponse.json({ lines: [] });
  }

  const code = data[0].file_content;
  const codeLines = code.split('\n');

  try {
    console.log('[Highlight] Calling OpenAI with transcript:', body.recentTranscript.slice(0, 100));

    const response = await getOpenAI().chat.completions.create({
      model: HIGHLIGHT_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are helping highlight relevant code during an oral programming examination.
Given the code and recent conversation, identify which line numbers are being discussed or are relevant.
Return a JSON object with a "lines" array of line numbers (1-indexed), e.g. {"lines": [5, 6, 7, 12, 15]}.
If no specific lines are relevant, return {"lines": []}.
Maximum 10 lines. Focus on the most recently discussed code.`,
        },
        {
          role: 'user',
          content: `Code (${data[0].filename}):\n\`\`\`\n${codeLines.map((line: string, i: number) => `${i + 1}: ${line}`).join('\n')}\n\`\`\`\n\nRecent conversation:\n${body.recentTranscript}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 100,
    });

    const content = response.choices[0]?.message?.content || '{"lines":[]}';
    console.log('[Highlight] OpenAI response:', content);

    // Parse the JSON response
    try {
      const parsed = JSON.parse(content);
      if (parsed.lines && Array.isArray(parsed.lines)) {
        // Validate line numbers
        const validLines = parsed.lines.filter((n: unknown) => typeof n === 'number' && n >= 1 && n <= codeLines.length);
        console.log('[Highlight] Valid lines:', validLines);
        return NextResponse.json({ lines: validLines.slice(0, 10) });
      }
    } catch (parseErr) {
      console.error('[Highlight] Failed to parse JSON:', parseErr, 'Content:', content);
    }

    // Fallback: try regex extraction
    const match = content.match(/\[[\d,\s]*\]/);
    if (match) {
      const lines = JSON.parse(match[0]) as number[];
      const validLines = lines.filter(n => typeof n === 'number' && n >= 1 && n <= codeLines.length);
      return NextResponse.json({ lines: validLines.slice(0, 10) });
    }

    return NextResponse.json({ lines: [] });
  } catch (error) {
    console.error('[Highlight] Failed to get highlight suggestions:', error);
    return NextResponse.json({ lines: [] });
  }
}
