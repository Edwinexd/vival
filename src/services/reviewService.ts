import { reviewCode, isJavaFile } from "@/lib/openai";
import { generateId } from "@/lib/id";
import { acquireGptSemaphore, releaseGptSemaphore } from "@/lib/redis/semaphore";
import {
  getSubmissionById,
  getAssignmentById,
  updateSubmissionStatus,
  createReview,
  getReviewBySubmission,
  type Submission,
  type Review,
  type Assignment,
} from "@/lib/db/queries";
import { compileSubmission, formatCompilationErrorsForReview } from "./compilationService";

function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [review-service] [${level.toUpperCase()}]`;
  if (data) {
    console[level](`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console[level](`${prefix} ${message}`);
  }
}

export interface ReviewJobResult {
  success: boolean;
  review?: Review;
  error?: string;
}

export async function processSubmissionReview(submissionId: string): Promise<ReviewJobResult> {
  log('info', `Starting review for submission`, { submissionId });

  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    log('error', `Submission not found`, { submissionId });
    return { success: false, error: "Submission not found" };
  }

  if (submission.status !== "pending" && submission.status !== "reviewing") {
    log('warn', `Invalid submission status`, { submissionId, status: submission.status });
    return { success: false, error: `Submission status is '${submission.status}', expected 'pending' or 'reviewing'` };
  }

  const assignment = await getAssignmentById(submission.assignment_id);
  if (!assignment) {
    log('error', `Assignment not found`, { submissionId, assignmentId: submission.assignment_id });
    return { success: false, error: "Assignment not found" };
  }

  const holderId = `review:${submissionId}:${Date.now()}`;
  const semaphoreResult = await acquireGptSemaphore(assignment.id, holderId);

  if (!semaphoreResult.acquired) {
    log('warn', `Failed to acquire semaphore - too many concurrent reviews`, { submissionId, assignmentId: assignment.id });
    return { success: false, error: "Too many concurrent reviews, please try again later" };
  }

  log('info', `Semaphore acquired, starting review process`, { submissionId, holderId });

  try {
    await updateSubmissionStatus(submissionId, "reviewing");

    // Build review prompt, optionally with compilation context for Java files
    let reviewPrompt = assignment.review_prompt || "";

    // Only run compilation check for Java files
    if (isJavaFile(submission.filename)) {
      log('info', `Running compilation check (Java file)`, { submissionId, filename: submission.filename });
      const compilationResult = await compileSubmission(submissionId);
      log('info', `Compilation result`, { submissionId, success: compilationResult.success, errorCount: compilationResult.errors?.length || 0 });

      if (!compilationResult.success) {
        const compilationContext = formatCompilationErrorsForReview(compilationResult);
        reviewPrompt = `IMPORTANT: The code failed to compile. Here are the compilation errors:\n${compilationContext}\n\nPlease review the code and address these compilation errors in your feedback.\n\n${reviewPrompt}`;
      }
    } else {
      log('info', `Skipping compilation (non-Java file)`, { submissionId, filename: submission.filename });
    }

    // Check if content has file markers (multi-file submission)
    const hasFileMarkers = /^\/\/\s*=====\s*.+?\s*=====\s*$/m.test(submission.file_content);
    if (hasFileMarkers) {
      reviewPrompt = `NOTE: This submission contains multiple files separated by "// ===== filename =====" markers. These markers are system delimiters, NOT code comments to be reviewed. Ignore them when checking syntax.\n\n${reviewPrompt}`;
    }

    log('info', `Calling OpenAI for code review`, { submissionId, codeLength: submission.file_content.length, hasFileMarkers });
    const startTime = Date.now();

    const reviewResult = await reviewCode(
      submission.file_content,
      submission.filename,
      reviewPrompt || null
    );

    const duration = Date.now() - startTime;
    log('info', `OpenAI review completed`, { submissionId, durationMs: duration, issueCount: reviewResult.issues.length });

    const reviewId = await generateId();
    const review = await createReview(
      reviewId,
      submissionId,
      "gpt-5",
      buildPromptUsed(submission, assignment),
      reviewResult.rawResponse,
      undefined,
      reviewResult.feedback,
      JSON.parse(JSON.stringify(reviewResult.issues)),
      JSON.parse(JSON.stringify(reviewResult.discussionPlan))
    );

    await updateSubmissionStatus(submissionId, "reviewed");

    log('info', `Review completed successfully`, { submissionId, reviewId });
    return { success: true, review };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error during review";
    const stack = error instanceof Error ? error.stack : undefined;
    log('error', `Review failed`, { submissionId, error: message, stack });

    await updateSubmissionStatus(submissionId, "pending");
    return { success: false, error: message };
  } finally {
    await releaseGptSemaphore(assignment.id, holderId);
    log('info', `Semaphore released`, { submissionId, holderId });
  }
}

function buildPromptUsed(submission: Submission, assignment: Assignment): string {
  let prompt = `File: ${submission.filename || "unknown"}\n`;
  if (assignment.review_prompt) {
    prompt += `Custom prompt: ${assignment.review_prompt}\n`;
  }
  prompt += `Code length: ${submission.file_content.length} characters`;
  return prompt;
}

export async function getSubmissionReview(submissionId: string): Promise<Review | null> {
  return getReviewBySubmission(submissionId);
}

export async function canStartReview(submissionId: string): Promise<{ allowed: boolean; reason?: string }> {
  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    return { allowed: false, reason: "Submission not found" };
  }

  if (submission.status !== "pending") {
    return { allowed: false, reason: `Submission status is '${submission.status}', expected 'pending'` };
  }

  const existingReview = await getReviewBySubmission(submissionId);
  if (existingReview) {
    return { allowed: false, reason: "Submission already has a review" };
  }

  return { allowed: true };
}

export async function batchReviewSubmissions(
  submissionIds: string[],
  onProgress?: (completed: number, total: number, results: ReviewJobResult[]) => void
): Promise<ReviewJobResult[]> {
  const results: ReviewJobResult[] = [];

  for (let i = 0; i < submissionIds.length; i++) {
    const result = await processSubmissionReview(submissionIds[i]);
    results.push(result);
    onProgress?.(i + 1, submissionIds.length, results);
  }

  return results;
}
