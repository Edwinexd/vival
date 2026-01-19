import { getDb } from '@/lib/db';
import { generateId } from '@/lib/id';
import { acquireSeminarSemaphore, releaseSeminarSemaphore } from '@/lib/redis/semaphore';
import {
  createConversationSession,
  generateSystemPrompt,
  getConversationTranscript,
  downloadConversationAudio,
  type SeminarContext,
  type DiscussionPlan,
  type TranscriptEntry,
  type ConversationConfigOverride,
} from '@/lib/elevenlabs';
import { processTranscriptGrading } from './gradingService';

export interface StartSeminarResult {
  success: boolean;
  signedUrl?: string;
  conversationId?: string;
  configOverride?: ConversationConfigOverride;
  error?: string;
}

export interface SeminarDetails {
  id: string;
  submissionId: string;
  slotId: string;
  language: 'en' | 'sv';
  status: string;
  conversationId: string | null;
  bookedAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
}

/**
 * Start a seminar session for a student
 */
export async function startSeminar(seminarId: string): Promise<StartSeminarResult> {
  const sql = getDb();

  // Get seminar with related data
  const seminars = await sql`
    SELECT
      s.*,
      sub.file_content,
      sub.filename,
      r.discussion_plan,
      r.parsed_feedback,
      a.name as assignment_name,
      a.description as assignment_description,
      a.target_time_minutes,
      a.max_time_minutes,
      u.name as student_name,
      u.su_username,
      slot.max_concurrent
    FROM seminars s
    JOIN submissions sub ON s.submission_id = sub.id
    LEFT JOIN reviews r ON r.submission_id = sub.id
    JOIN assignments a ON sub.assignment_id = a.id
    JOIN users u ON sub.student_id = u.id
    JOIN seminar_slots slot ON s.slot_id = slot.id
    WHERE s.id = ${seminarId}
  `;

  if (seminars.length === 0) {
    return { success: false, error: 'Seminar not found' };
  }

  const seminar = seminars[0];

  // Check if seminar is in bookable state
  if (seminar.status !== 'booked' && seminar.status !== 'waiting') {
    return { success: false, error: `Seminar cannot be started (status: ${seminar.status})` };
  }

  // Check time window
  const now = new Date();
  const slotInfo = await sql`
    SELECT window_start, window_end FROM seminar_slots WHERE id = ${seminar.slot_id}
  `;

  if (slotInfo.length === 0) {
    return { success: false, error: 'Seminar slot not found' };
  }

  const { window_start, window_end } = slotInfo[0];

  if (now < new Date(window_start)) {
    return { success: false, error: 'Seminar window has not opened yet' };
  }

  if (now > new Date(window_end)) {
    return { success: false, error: 'Seminar window has closed' };
  }

  // Try to acquire semaphore (max concurrent seminars)
  const acquired = await acquireSeminarSemaphore(seminar.slot_id, seminarId);

  if (!acquired) {
    // Update status to waiting
    await sql`
      UPDATE seminars SET status = 'waiting' WHERE id = ${seminarId}
    `;
    return { success: false, error: 'All seminar slots are currently in use. Please wait.' };
  }

  try {
    // Parse discussion plan from review
    let discussionPlan: DiscussionPlan;

    if (seminar.discussion_plan) {
      const parsed = typeof seminar.discussion_plan === 'string'
        ? JSON.parse(seminar.discussion_plan)
        : seminar.discussion_plan;

      // Handle different formats: array of topics OR {overview, keyTopics, conceptChecks}
      if (Array.isArray(parsed)) {
        // Convert array format to expected structure
        discussionPlan = {
          overview: seminar.parsed_feedback || 'A programming assignment submission.',
          keyTopics: parsed.map((t: { topic: string; question: string; expectedAnswer: string; followUpQuestions?: string[]; context?: string }) => ({
            topic: t.topic,
            question: t.question,
            expectedAnswer: t.expectedAnswer,
            followUp: Array.isArray(t.followUpQuestions) ? t.followUpQuestions.join(' ') : '',
            redFlags: [],
          })),
          conceptChecks: [],
        };
      } else {
        discussionPlan = parsed || {};
        if (!discussionPlan.overview) discussionPlan.overview = 'A programming assignment submission.';
        if (!Array.isArray(discussionPlan.keyTopics)) discussionPlan.keyTopics = [];
        if (!Array.isArray(discussionPlan.conceptChecks)) discussionPlan.conceptChecks = [];
      }
    } else {
      // Fallback if no discussion plan exists
      discussionPlan = {
        overview: 'A programming assignment submission.',
        keyTopics: [{
          topic: 'Code explanation',
          question: 'Can you walk me through your code and explain what it does?',
          expectedAnswer: 'Student should be able to explain the main logic and flow',
          followUp: 'What does this specific part do?',
          redFlags: ['Cannot explain basic logic', 'Inconsistent terminology'],
        }],
        conceptChecks: [{
          concept: 'General understanding',
          question: 'What was the most challenging part of this assignment?',
        }],
      };
    }

    // Build seminar context
    const context: SeminarContext = {
      studentName: seminar.student_name || seminar.su_username,
      assignmentName: seminar.assignment_name,
      assignmentDescription: seminar.assignment_description || '',
      discussionPlan,
      language: seminar.language || 'en',
      targetTimeMinutes: seminar.target_time_minutes ?? 30,
      maxTimeMinutes: seminar.max_time_minutes ?? 35,
    };

    // Generate system prompt
    const systemPrompt = generateSystemPrompt(context);

    // Build first message for the agent
    const firstName = context.studentName.split(' ')[0];
    const firstMessage = seminar.language === 'sv'
      ? `Hej ${firstName}! Välkommen till din muntliga examination för ${seminar.assignment_name}. Kan du börja med att berätta med egna ord vad din kod gör?`
      : `Hello ${firstName}! Welcome to your oral examination for ${seminar.assignment_name}. Could you start by describing in your own words what your code does?`;

    // Build config override to send via WebSocket
    const configOverride: ConversationConfigOverride = {
      agent: {
        prompt: {
          prompt: systemPrompt,
        },
        first_message: firstMessage,
        language: seminar.language || 'en',
      },
    };

    // Get signed URL from ElevenLabs
    const session = await createConversationSession();

    // Update seminar status - conversation_id will be set when client reports it after WebSocket connects
    await sql`
      UPDATE seminars
      SET
        status = 'in_progress',
        started_at = NOW()
      WHERE id = ${seminarId}
    `;

    return {
      success: true,
      signedUrl: session.signed_url,
      configOverride,
    };
  } catch (error) {
    // Release semaphore on failure
    await releaseSeminarSemaphore(seminar.slot_id, seminarId);

    // Update status back to booked
    await sql`
      UPDATE seminars SET status = 'booked' WHERE id = ${seminarId}
    `;

    console.error('Failed to start seminar:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start seminar',
    };
  }
}

/**
 * Complete a seminar and save transcript/recording
 */
export async function completeSeminar(
  conversationId: string,
  status: 'completed' | 'failed' | 'abandoned',
  durationSeconds?: number
): Promise<void> {
  const sql = getDb();

  // Find seminar by conversation ID
  const seminars = await sql`
    SELECT s.*, slot.id as slot_id
    FROM seminars s
    JOIN seminar_slots slot ON s.slot_id = slot.id
    WHERE s.elevenlabs_conversation_id = ${conversationId}
  `;

  if (seminars.length === 0) {
    console.error(`Seminar not found for conversation: ${conversationId}`);
    return;
  }

  const seminar = seminars[0];

  // Release semaphore
  await releaseSeminarSemaphore(seminar.slot_id, seminar.id);

  // Map status
  const seminarStatus = status === 'completed' ? 'completed' : 'failed';

  // Update seminar
  await sql`
    UPDATE seminars
    SET
      status = ${seminarStatus},
      ended_at = NOW(),
      duration_seconds = ${durationSeconds || null}
    WHERE id = ${seminar.id}
  `;

  // Update submission status
  await sql`
    UPDATE submissions
    SET status = ${status === 'completed' ? 'seminar_completed' : 'seminar_pending'}
    WHERE id = ${seminar.submission_id}
  `;

  // Fetch and save transcript
  let transcriptSaved = false;
  try {
    const transcript = await getConversationTranscript(conversationId);
    await saveTranscript(seminar.id, transcript);
    transcriptSaved = true;
  } catch (error) {
    console.error('Failed to fetch transcript:', error);
  }

  // Fetch and save audio recording
  try {
    const audio = await downloadConversationAudio(conversationId);
    if (audio) {
      await saveRecording(seminar.id, audio.buffer, audio.mimeType, durationSeconds || 0);
    }
  } catch (error) {
    console.error('Failed to fetch audio recording:', error);
  }

  // Trigger AI grading asynchronously (non-blocking) if seminar completed and transcript saved
  if (status === 'completed' && transcriptSaved) {
    processTranscriptGrading(seminar.id).catch(error => {
      console.error('Failed to process transcript grading:', error);
    });
  }
}

/**
 * Save transcript entries to database
 */
async function saveTranscript(seminarId: string, entries: TranscriptEntry[]): Promise<void> {
  const sql = getDb();

  for (const entry of entries) {
    const id = await generateId();
    await sql`
      INSERT INTO transcripts (id, seminar_id, speaker, text, timestamp_ms, confidence)
      VALUES (${id}, ${seminarId}, ${entry.role}, ${entry.text}, ${entry.timestamp_ms}, ${entry.confidence || null})
    `;
  }
}

/**
 * Save audio recording to database
 */
async function saveRecording(
  seminarId: string,
  audioData: Buffer,
  mimeType: string,
  durationSeconds: number
): Promise<void> {
  const sql = getDb();
  const id = await generateId();

  await sql`
    INSERT INTO recordings (id, seminar_id, audio_data, mime_type, duration_seconds, size_bytes)
    VALUES (${id}, ${seminarId}, ${audioData}, ${mimeType}, ${durationSeconds}, ${audioData.length})
  `;
}

/**
 * Get seminar status for student
 */
export async function getSeminarStatus(seminarId: string): Promise<SeminarDetails | null> {
  const sql = getDb();

  const seminars = await sql`
    SELECT * FROM seminars WHERE id = ${seminarId}
  `;

  if (seminars.length === 0) {
    return null;
  }

  const s = seminars[0];

  return {
    id: s.id,
    submissionId: s.submission_id,
    slotId: s.slot_id,
    language: s.language,
    status: s.status,
    conversationId: s.elevenlabs_conversation_id,
    bookedAt: s.booked_at,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    durationSeconds: s.duration_seconds,
  };
}

/**
 * Check if student can start their seminar
 */
export async function canStartSeminar(seminarId: string): Promise<{
  canStart: boolean;
  reason?: string;
  activeCount?: number;
  maxConcurrent?: number;
}> {
  const sql = getDb();

  const seminars = await sql`
    SELECT s.*, slot.window_start, slot.window_end, slot.max_concurrent
    FROM seminars s
    JOIN seminar_slots slot ON s.slot_id = slot.id
    WHERE s.id = ${seminarId}
  `;

  if (seminars.length === 0) {
    return { canStart: false, reason: 'Seminar not found' };
  }

  const seminar = seminars[0];
  const now = new Date();

  // Check status
  if (seminar.status === 'in_progress') {
    return { canStart: false, reason: 'Seminar already in progress' };
  }

  if (seminar.status === 'completed') {
    return { canStart: false, reason: 'Seminar already completed' };
  }

  // Check time window
  if (now < new Date(seminar.window_start)) {
    return { canStart: false, reason: 'Seminar window has not opened yet' };
  }

  if (now > new Date(seminar.window_end)) {
    return { canStart: false, reason: 'Seminar window has closed' };
  }

  // Check concurrent count
  const activeCount = await sql`
    SELECT COUNT(*) as count
    FROM seminars
    WHERE slot_id = ${seminar.slot_id} AND status = 'in_progress'
  `;

  const active = parseInt(activeCount[0].count, 10);

  if (active >= seminar.max_concurrent) {
    return {
      canStart: false,
      reason: 'All slots currently in use, please wait',
      activeCount: active,
      maxConcurrent: seminar.max_concurrent,
    };
  }

  return { canStart: true, activeCount: active, maxConcurrent: seminar.max_concurrent };
}
