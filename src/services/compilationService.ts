import { getSubmissionById, updateSubmissionCompilation } from "@/lib/db/queries";

const COMPILER_URL = process.env.COMPILER_URL || "http://localhost:3001";

export interface CompileError {
  file: string;
  line: number;
  message: string;
  type: "error" | "warning";
}

export interface CompilationResult {
  success: boolean;
  output: string;
  errors: CompileError[];
  duration_ms: number;
}

export interface CompileFile {
  name: string;
  content: string;
}

/**
 * Parse files from combined content using `// ===== filename =====` markers.
 * Falls back to treating the entire content as a single file if no markers found.
 */
export function parseFilesFromContent(content: string, defaultFilename: string | null): CompileFile[] {
  const markerRegex = /^\/\/\s*=====\s*(.+?\.java)\s*=====\s*$/gm;
  const files: CompileFile[] = [];

  let match: RegExpExecArray | null;
  const markers: Array<{ filename: string; index: number }> = [];

  while ((match = markerRegex.exec(content)) !== null) {
    markers.push({
      filename: match[1].trim(),
      index: match.index + match[0].length,
    });
  }

  if (markers.length === 0) {
    // No markers found, treat as single file
    const filename = defaultFilename || "Main.java";
    return [{ name: filename, content: content.trim() }];
  }

  // Extract content between markers
  for (let i = 0; i < markers.length; i++) {
    const startIndex = markers[i].index;
    const endIndex = i < markers.length - 1 ? content.lastIndexOf("//", markers[i + 1].index - 1) : content.length;
    const fileContent = content.slice(startIndex, endIndex).trim();

    if (fileContent) {
      files.push({
        name: markers[i].filename,
        content: fileContent,
      });
    }
  }

  return files;
}

/**
 * Call the compiler service to compile files.
 */
async function callCompiler(files: CompileFile[], timeout: number = 30000): Promise<CompilationResult> {
  const response = await fetch(`${COMPILER_URL}/compile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files, timeout }),
  });

  if (!response.ok) {
    return {
      success: false,
      output: `Compiler service error: ${response.status} ${response.statusText}`,
      errors: [],
      duration_ms: 0,
    };
  }

  return response.json();
}

/**
 * Compile a submission and store the results.
 * Returns the compilation result (success/failure with errors).
 */
export async function compileSubmission(submissionId: string): Promise<CompilationResult> {
  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    return {
      success: false,
      output: "Submission not found",
      errors: [],
      duration_ms: 0,
    };
  }

  const files = parseFilesFromContent(submission.file_content, submission.filename);

  if (files.length === 0) {
    const result: CompilationResult = {
      success: false,
      output: "No Java files found in submission",
      errors: [],
      duration_ms: 0,
    };
    await updateSubmissionCompilation(submissionId, result.success, result.output, JSON.parse(JSON.stringify(result.errors)));
    return result;
  }

  try {
    const result = await callCompiler(files);
    await updateSubmissionCompilation(submissionId, result.success, result.output, JSON.parse(JSON.stringify(result.errors)));
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown compilation error";
    const result: CompilationResult = {
      success: false,
      output: `Compilation service unavailable: ${errorMessage}`,
      errors: [],
      duration_ms: 0,
    };
    await updateSubmissionCompilation(submissionId, result.success, result.output, JSON.parse(JSON.stringify(result.errors)));
    return result;
  }
}

/**
 * Strip file marker comments (// ===== filename =====) from code content.
 * These markers are used to separate multiple files but confuse GPT when reviewing non-Java files.
 */
export function stripFileMarkers(content: string): string {
  // Match // ===== filename.ext ===== pattern on its own line
  return content.replace(/^\/\/\s*=====\s*.+?\s*=====\s*\n?/gm, "").trim();
}

/**
 * Format compilation errors for inclusion in GPT review context.
 */
export function formatCompilationErrorsForReview(result: CompilationResult): string {
  if (result.success) {
    return "Code compiles successfully.";
  }

  let formatted = "COMPILATION FAILED:\n";

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      formatted += `- ${error.file}:${error.line}: ${error.type}: ${error.message}\n`;
    }
  } else if (result.output) {
    formatted += result.output;
  }

  return formatted;
}
