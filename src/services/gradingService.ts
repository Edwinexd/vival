import { generateId } from '@/lib/id';
import {
  gradeTranscript,
  type GradingVariation,
  type TranscriptGradeResult,
  type DiscussionPoint,
} from '@/lib/openai';
import {
  getSeminarById,
  getReviewBySubmission,
  getTranscriptsBySeminar,
  createAiGrade,
  updateAiGradeScores,
  updateAiGradeStatus,
  getAiGradeBySeminar,
  type AiGrade,
  type Transcript,
} from '@/lib/db/queries';

function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [grading-service] [${level.toUpperCase()}]`;
  if (data) {
    console[level](`${prefix} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console[level](`${prefix} ${message}`);
  }
}

export interface GradingJobResult {
  success: boolean;
  aiGrade?: AiGrade;
  error?: string;
}

interface SingleGradeResult {
  variation: GradingVariation;
  result?: TranscriptGradeResult;
  error?: string;
}

/**
 * Calculate suggested score from 3 GPT grades
 * Uses average by default, but switches to median if range > 20 points
 */
export function calculateSuggestedScore(scores: (number | null)[]): { score: number; method: 'average' | 'median' } {
  const validScores = scores.filter((s): s is number => s !== null);

  if (validScores.length === 0) {
    return { score: 0, method: 'average' };
  }

  if (validScores.length === 1) {
    return { score: validScores[0], method: 'average' };
  }

  const min = Math.min(...validScores);
  const max = Math.max(...validScores);
  const range = max - min;

  if (range > 20 && validScores.length >= 3) {
    // Use median to reduce outlier impact
    const sorted = [...validScores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    return { score: median, method: 'median' };
  }

  // Use average
  const sum = validScores.reduce((a, b) => a + b, 0);
  const average = Math.round(sum / validScores.length);
  return { score: average, method: 'average' };
}

/**
 * Format transcript entries into a readable string
 */
function formatTranscript(entries: Transcript[]): string {
  return entries
    .map(e => {
      const speaker = e.speaker === 'agent' ? 'Examiner' : 'Student';
      return `${speaker}: ${e.text || ''}`;
    })
    .join('\n\n');
}

/**
 * Grade a single instance with a specific variation
 */
async function gradeSingleInstance(
  discussionPlan: DiscussionPoint[],
  transcript: string,
  language: 'en' | 'sv',
  variation: GradingVariation
): Promise<SingleGradeResult> {
  try {
    const result = await gradeTranscript(discussionPlan, transcript, language, variation);
    return { variation, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log('error', `Grade instance failed`, { variation, error: message });
    return { variation, error: message };
  }
}

/**
 * Process transcript grading for a completed seminar
 * Calls GPT-5 three times with different variations and calculates suggested score
 */
export async function processTranscriptGrading(seminarId: string): Promise<GradingJobResult> {
  log('info', `Starting transcript grading`, { seminarId });

  // Check if already graded
  const existingGrade = await getAiGradeBySeminar(seminarId);
  if (existingGrade && existingGrade.status === 'completed') {
    log('info', `Seminar already graded`, { seminarId, aiGradeId: existingGrade.id });
    return { success: true, aiGrade: existingGrade };
  }

  // Get seminar details
  const seminar = await getSeminarById(seminarId);
  if (!seminar) {
    log('error', `Seminar not found`, { seminarId });
    return { success: false, error: 'Seminar not found' };
  }

  if (seminar.status !== 'completed') {
    log('warn', `Seminar not completed`, { seminarId, status: seminar.status });
    return { success: false, error: `Seminar status is '${seminar.status}', expected 'completed'` };
  }

  // Get review with discussion plan
  const review = await getReviewBySubmission(seminar.submission_id);
  if (!review) {
    log('warn', `No review found for submission`, { seminarId, submissionId: seminar.submission_id });
    return { success: false, error: 'No review found for this submission' };
  }

  // Get transcript
  const transcriptEntries = await getTranscriptsBySeminar(seminarId);
  if (transcriptEntries.length === 0) {
    log('warn', `No transcript found`, { seminarId });
    return { success: false, error: 'No transcript found for this seminar' };
  }

  const transcriptText = formatTranscript(transcriptEntries);
  const discussionPlan = (review.discussion_plan as DiscussionPoint[]) || [];
  const language = (seminar.language || 'en') as 'en' | 'sv';

  // Create or update AI grade record
  let aiGrade: AiGrade;
  if (existingGrade) {
    aiGrade = existingGrade;
    await updateAiGradeStatus(aiGrade.id, 'in_progress');
  } else {
    const aiGradeId = await generateId();
    aiGrade = await createAiGrade(aiGradeId, seminarId, seminar.submission_id);
  }

  log('info', `Starting 3 GPT grading instances`, {
    seminarId,
    aiGradeId: aiGrade.id,
    transcriptLength: transcriptText.length,
    discussionPointCount: discussionPlan.length,
    language,
  });

  try {
    // Run all 3 grading instances in parallel
    const variations: GradingVariation[] = ['strict', 'balanced', 'generous'];
    const results = await Promise.all(
      variations.map(v => gradeSingleInstance(discussionPlan, transcriptText, language, v))
    );

    const strictResult = results.find(r => r.variation === 'strict');
    const balancedResult = results.find(r => r.variation === 'balanced');
    const generousResult = results.find(r => r.variation === 'generous');

    const scores = [
      strictResult?.result?.score ?? null,
      balancedResult?.result?.score ?? null,
      generousResult?.result?.score ?? null,
    ];

    const { score: suggestedScore, method: scoringMethod } = calculateSuggestedScore(scores);

    // Update AI grade with scores
    await updateAiGradeScores(aiGrade.id, {
      score_1: strictResult?.result?.score ?? null,
      reasoning_1: strictResult?.result?.reasoning || strictResult?.error || null,
      score_2: balancedResult?.result?.score ?? null,
      reasoning_2: balancedResult?.result?.reasoning || balancedResult?.error || null,
      score_3: generousResult?.result?.score ?? null,
      reasoning_3: generousResult?.result?.reasoning || generousResult?.error || null,
      suggested_score: suggestedScore,
      scoring_method: scoringMethod,
    });

    // Determine final status
    const successCount = scores.filter(s => s !== null).length;
    const allFailed = successCount === 0;

    if (allFailed) {
      const errorMessages = results.map(r => r.error).filter(Boolean).join('; ');
      await updateAiGradeStatus(aiGrade.id, 'failed', errorMessages);
      log('error', `All grading instances failed`, { seminarId, aiGradeId: aiGrade.id, errors: errorMessages });
      return { success: false, error: 'All grading instances failed', aiGrade };
    }

    await updateAiGradeStatus(aiGrade.id, 'completed');

    log('info', `Grading completed`, {
      seminarId,
      aiGradeId: aiGrade.id,
      scores,
      suggestedScore,
      scoringMethod,
      successCount,
    });

    // Refetch to get updated record
    const updatedGrade = await getAiGradeBySeminar(seminarId);
    return { success: true, aiGrade: updatedGrade || aiGrade };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during grading';
    log('error', `Grading failed unexpectedly`, { seminarId, aiGradeId: aiGrade.id, error: message });

    await updateAiGradeStatus(aiGrade.id, 'failed', message);
    return { success: false, error: message, aiGrade };
  }
}

/**
 * Retry grading for a failed AI grade
 */
export async function retryGrading(seminarId: string): Promise<GradingJobResult> {
  log('info', `Retrying grading`, { seminarId });
  return processTranscriptGrading(seminarId);
}
