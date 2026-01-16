import { getDb } from "./index";

// JSON-compatible type for JSONB columns
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// Types - using string for BIGINT IDs (avoids JSON serialization issues with bigint)
export interface User {
  id: string;
  su_username: string;
  email: string | null;
  name: string | null;
  is_admin: boolean;
  created_at: Date;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  semester: string | null;
  created_at: Date;
}

export interface Assignment {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  review_prompt: string | null;
  seminar_prompt: string | null;
  due_date: Date | null;
  created_at: Date;
}

export interface Submission {
  id: string;
  student_id: string;
  assignment_id: string;
  filename: string | null;
  file_content: string;
  file_hash: string | null;
  status: string;
  uploaded_at: Date;
  uploaded_by: string;
  compile_success: boolean | null;
  compile_output: string | null;
  compile_errors: unknown;
  compiled_at: Date | null;
}

export interface Review {
  id: string;
  submission_id: string;
  gpt_model: string | null;
  prompt_used: string | null;
  raw_response: string | null;
  parsed_score: number | null;
  parsed_feedback: string | null;
  issues_found: unknown;
  discussion_plan: unknown;
  created_at: Date;
}

export interface SeminarSlot {
  id: string;
  assignment_id: string;
  window_start: Date;
  window_end: Date;
  max_concurrent: number;
  created_by: string;
  created_at: Date;
}

export interface Seminar {
  id: string;
  submission_id: string;
  slot_id: string;
  language: string;
  elevenlabs_conversation_id: string | null;
  status: string;
  booked_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
}

export interface Transcript {
  id: string;
  seminar_id: string;
  speaker: string | null;
  text: string | null;
  timestamp_ms: number | null;
  confidence: number | null;
}

export interface Recording {
  id: string;
  seminar_id: string;
  audio_data: Buffer | null;
  mime_type: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  created_at: Date;
}

export interface Grade {
  id: string;
  submission_id: string;
  reviewed_by: string;
  review_score: number | null;
  seminar_score: number | null;
  final_grade: string | null;
  admin_notes: string | null;
  student_feedback: string | null;
  created_at: Date;
  updated_at: Date;
}

// User queries
export async function getUserById(id: string): Promise<User | null> {
  const sql = getDb();
  const result = await sql<User[]>`
    SELECT * FROM users WHERE id = ${id}
  `;
  return result[0] ?? null;
}

// Get user by username with flexible matching
// Matches usernames with or without domain suffix (e.g., "bbohm" matches "bbohm@SU.SE")
export async function getUserByUsername(suUsername: string): Promise<User | null> {
  const sql = getDb();
  // Extract base username (before @) and compare case-insensitively
  // This allows "bbohm@SU.SE" to match "bbohm" in DB and vice versa
  const result = await sql<User[]>`
    SELECT * FROM users
    WHERE LOWER(SPLIT_PART(su_username, '@', 1)) = LOWER(SPLIT_PART(${suUsername}, '@', 1))
    LIMIT 1
  `;
  return result[0] ?? null;
}

export async function createUser(
  id: string,
  suUsername: string,
  email?: string,
  name?: string,
  isAdmin?: boolean
): Promise<User> {
  const sql = getDb();
  const result = await sql<User[]>`
    INSERT INTO users (id, su_username, email, name, is_admin)
    VALUES (${id}, ${suUsername}, ${email ?? null}, ${name ?? null}, ${isAdmin ?? false})
    RETURNING *
  `;
  return result[0];
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<User, "email" | "name" | "is_admin">>
): Promise<User | null> {
  const sql = getDb();
  const result = await sql<User[]>`
    UPDATE users
    SET
      email = COALESCE(${updates.email ?? null}, email),
      name = COALESCE(${updates.name ?? null}, name),
      is_admin = COALESCE(${updates.is_admin ?? null}, is_admin)
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] ?? null;
}

// Course queries
export async function getCourseById(id: string): Promise<Course | null> {
  const sql = getDb();
  const result = await sql<Course[]>`
    SELECT * FROM courses WHERE id = ${id}
  `;
  return result[0] ?? null;
}

export async function getAllCourses(): Promise<Course[]> {
  const sql = getDb();
  return sql<Course[]>`
    SELECT * FROM courses ORDER BY created_at DESC
  `;
}

export async function createCourse(
  id: string,
  code: string,
  name: string,
  semester?: string
): Promise<Course> {
  const sql = getDb();
  const result = await sql<Course[]>`
    INSERT INTO courses (id, code, name, semester)
    VALUES (${id}, ${code}, ${name}, ${semester ?? null})
    RETURNING *
  `;
  return result[0];
}

// Assignment queries
export async function getAssignmentById(id: string): Promise<Assignment | null> {
  const sql = getDb();
  const result = await sql<Assignment[]>`
    SELECT * FROM assignments WHERE id = ${id}
  `;
  return result[0] ?? null;
}

export async function getAssignmentsByCourse(courseId: string): Promise<Assignment[]> {
  const sql = getDb();
  return sql<Assignment[]>`
    SELECT * FROM assignments WHERE course_id = ${courseId} ORDER BY due_date ASC
  `;
}

export async function getAllAssignments(): Promise<Assignment[]> {
  const sql = getDb();
  return sql<Assignment[]>`
    SELECT * FROM assignments ORDER BY created_at DESC
  `;
}

export async function createAssignment(
  id: string,
  courseId: string,
  name: string,
  description?: string,
  reviewPrompt?: string,
  seminarPrompt?: string,
  dueDate?: Date
): Promise<Assignment> {
  const sql = getDb();
  const result = await sql<Assignment[]>`
    INSERT INTO assignments (id, course_id, name, description, review_prompt, seminar_prompt, due_date)
    VALUES (${id}, ${courseId}, ${name}, ${description ?? null}, ${reviewPrompt ?? null}, ${seminarPrompt ?? null}, ${dueDate ?? null})
    RETURNING *
  `;
  return result[0];
}

export async function updateAssignment(
  id: string,
  updates: Partial<Pick<Assignment, "name" | "description" | "review_prompt" | "seminar_prompt" | "due_date">>
): Promise<Assignment | null> {
  const sql = getDb();
  const result = await sql<Assignment[]>`
    UPDATE assignments
    SET
      name = COALESCE(${updates.name ?? null}, name),
      description = COALESCE(${updates.description ?? null}, description),
      review_prompt = COALESCE(${updates.review_prompt ?? null}, review_prompt),
      seminar_prompt = COALESCE(${updates.seminar_prompt ?? null}, seminar_prompt),
      due_date = COALESCE(${updates.due_date ?? null}, due_date)
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] ?? null;
}

export async function deleteAssignment(id: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    DELETE FROM assignments WHERE id = ${id}
  `;
  return result.count > 0;
}

// Submission queries
export async function getSubmissionById(id: string): Promise<Submission | null> {
  const sql = getDb();
  const result = await sql<Submission[]>`
    SELECT * FROM submissions WHERE id = ${id}
  `;
  return result[0] ?? null;
}

export async function getSubmissionsByStudent(studentId: string): Promise<Submission[]> {
  const sql = getDb();
  return sql<Submission[]>`
    SELECT * FROM submissions WHERE student_id = ${studentId} ORDER BY uploaded_at DESC
  `;
}

export async function getSubmissionsByAssignment(assignmentId: string): Promise<Submission[]> {
  const sql = getDb();
  return sql<Submission[]>`
    SELECT * FROM submissions WHERE assignment_id = ${assignmentId} ORDER BY uploaded_at DESC
  `;
}

export async function getSubmissionsByStatus(status: string): Promise<Submission[]> {
  const sql = getDb();
  return sql<Submission[]>`
    SELECT * FROM submissions WHERE status = ${status} ORDER BY uploaded_at ASC
  `;
}

export async function createSubmission(
  id: string,
  studentId: string,
  assignmentId: string,
  fileContent: string,
  uploadedBy: string,
  filename?: string,
  fileHash?: string
): Promise<Submission> {
  const sql = getDb();
  const result = await sql<Submission[]>`
    INSERT INTO submissions (id, student_id, assignment_id, filename, file_content, file_hash, uploaded_by)
    VALUES (${id}, ${studentId}, ${assignmentId}, ${filename ?? null}, ${fileContent}, ${fileHash ?? null}, ${uploadedBy})
    RETURNING *
  `;
  return result[0];
}

export async function updateSubmissionStatus(id: string, status: string): Promise<Submission | null> {
  const sql = getDb();
  const result = await sql<Submission[]>`
    UPDATE submissions SET status = ${status} WHERE id = ${id} RETURNING *
  `;
  return result[0] ?? null;
}

export async function updateSubmissionCompilation(
  id: string,
  success: boolean,
  output: string,
  errors: JsonValue
): Promise<Submission | null> {
  const sql = getDb();
  const result = await sql<Submission[]>`
    UPDATE submissions
    SET
      compile_success = ${success},
      compile_output = ${output},
      compile_errors = ${sql.json(errors)},
      compiled_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] ?? null;
}

// Review queries
export async function getReviewById(id: string): Promise<Review | null> {
  const sql = getDb();
  const result = await sql<Review[]>`
    SELECT * FROM reviews WHERE id = ${id}
  `;
  return result[0] ?? null;
}

export async function getReviewBySubmission(submissionId: string): Promise<Review | null> {
  const sql = getDb();
  const result = await sql<Review[]>`
    SELECT * FROM reviews WHERE submission_id = ${submissionId} ORDER BY created_at DESC LIMIT 1
  `;
  return result[0] ?? null;
}

export async function createReview(
  id: string,
  submissionId: string,
  gptModel?: string,
  promptUsed?: string,
  rawResponse?: string,
  parsedScore?: number,
  parsedFeedback?: string,
  issuesFound?: JsonValue,
  discussionPlan?: JsonValue
): Promise<Review> {
  const sql = getDb();
  const result = await sql<Review[]>`
    INSERT INTO reviews (id, submission_id, gpt_model, prompt_used, raw_response, parsed_score, parsed_feedback, issues_found, discussion_plan)
    VALUES (${id}, ${submissionId}, ${gptModel ?? null}, ${promptUsed ?? null}, ${rawResponse ?? null}, ${parsedScore ?? null}, ${parsedFeedback ?? null}, ${issuesFound !== undefined ? sql.json(issuesFound) : null}, ${discussionPlan !== undefined ? sql.json(discussionPlan) : null})
    RETURNING *
  `;
  return result[0];
}

// Seminar slot queries
export async function getSeminarSlotById(id: string): Promise<SeminarSlot | null> {
  const sql = getDb();
  const result = await sql<SeminarSlot[]>`
    SELECT * FROM seminar_slots WHERE id = ${id}
  `;
  return result[0] ?? null;
}

export async function getSeminarSlotsByAssignment(assignmentId: string): Promise<SeminarSlot[]> {
  const sql = getDb();
  return sql<SeminarSlot[]>`
    SELECT * FROM seminar_slots WHERE assignment_id = ${assignmentId} ORDER BY window_start ASC
  `;
}

export async function getAvailableSeminarSlots(assignmentId: string): Promise<SeminarSlot[]> {
  const sql = getDb();
  return sql<SeminarSlot[]>`
    SELECT ss.*
    FROM seminar_slots ss
    WHERE ss.assignment_id = ${assignmentId}
      AND ss.window_start > NOW()
      AND (
        SELECT COUNT(*) FROM seminars s
        WHERE s.slot_id = ss.id AND s.status NOT IN ('failed', 'no_show')
      ) < ss.max_concurrent
    ORDER BY ss.window_start ASC
  `;
}

export async function createSeminarSlot(
  id: string,
  assignmentId: string,
  windowStart: Date,
  windowEnd: Date,
  createdBy: string,
  maxConcurrent?: number
): Promise<SeminarSlot> {
  const sql = getDb();
  const result = await sql<SeminarSlot[]>`
    INSERT INTO seminar_slots (id, assignment_id, window_start, window_end, max_concurrent, created_by)
    VALUES (${id}, ${assignmentId}, ${windowStart}, ${windowEnd}, ${maxConcurrent ?? 8}, ${createdBy})
    RETURNING *
  `;
  return result[0];
}

// Seminar queries
export async function getSeminarById(id: string): Promise<Seminar | null> {
  const sql = getDb();
  const result = await sql<Seminar[]>`
    SELECT * FROM seminars WHERE id = ${id}
  `;
  return result[0] ?? null;
}

export async function getSeminarBySubmission(submissionId: string): Promise<Seminar | null> {
  const sql = getDb();
  const result = await sql<Seminar[]>`
    SELECT * FROM seminars WHERE submission_id = ${submissionId} ORDER BY booked_at DESC LIMIT 1
  `;
  return result[0] ?? null;
}

export async function getSeminarsBySlot(slotId: string): Promise<Seminar[]> {
  const sql = getDb();
  return sql<Seminar[]>`
    SELECT * FROM seminars WHERE slot_id = ${slotId} ORDER BY booked_at ASC
  `;
}

export async function createSeminar(
  id: string,
  submissionId: string,
  slotId: string,
  language?: string
): Promise<Seminar> {
  const sql = getDb();
  const result = await sql<Seminar[]>`
    INSERT INTO seminars (id, submission_id, slot_id, language)
    VALUES (${id}, ${submissionId}, ${slotId}, ${language ?? 'en'})
    RETURNING *
  `;
  return result[0];
}

export async function updateSeminarStatus(
  id: string,
  status: string,
  conversationId?: string
): Promise<Seminar | null> {
  const sql = getDb();
  const result = await sql<Seminar[]>`
    UPDATE seminars
    SET
      status = ${status},
      elevenlabs_conversation_id = COALESCE(${conversationId ?? null}, elevenlabs_conversation_id),
      started_at = CASE WHEN ${status} = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
      ended_at = CASE WHEN ${status} IN ('completed', 'failed', 'no_show') THEN NOW() ELSE ended_at END
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] ?? null;
}

export async function updateSeminarDuration(id: string, durationSeconds: number): Promise<Seminar | null> {
  const sql = getDb();
  const result = await sql<Seminar[]>`
    UPDATE seminars SET duration_seconds = ${durationSeconds} WHERE id = ${id} RETURNING *
  `;
  return result[0] ?? null;
}

export async function markSeminarNoShow(seminarId: string): Promise<{ seminar: Seminar; submissionId: string } | null> {
  const sql = getDb();

  // Get the seminar first to find submission_id
  const seminars = await sql<Seminar[]>`
    SELECT * FROM seminars WHERE id = ${seminarId}
  `;

  if (seminars.length === 0) {
    return null;
  }

  const seminar = seminars[0];

  // Only allow marking as no_show if seminar is in booked or waiting status
  if (!['booked', 'waiting'].includes(seminar.status)) {
    return null;
  }

  // Update seminar status to no_show
  const updated = await sql<Seminar[]>`
    UPDATE seminars
    SET status = 'no_show', ended_at = NOW()
    WHERE id = ${seminarId}
    RETURNING *
  `;

  // Revert submission status back to reviewed so student can rebook
  await sql`
    UPDATE submissions
    SET status = 'reviewed'
    WHERE id = ${seminar.submission_id}
  `;

  return { seminar: updated[0], submissionId: seminar.submission_id };
}

export async function markExpiredSeminarsNoShow(): Promise<number> {
  const sql = getDb();

  // Find all seminars where the slot window has ended and status is still booked/waiting
  const expired = await sql<{ id: string; submission_id: string }[]>`
    SELECT s.id, s.submission_id
    FROM seminars s
    JOIN seminar_slots slot ON s.slot_id = slot.id
    WHERE s.status IN ('booked', 'waiting')
    AND slot.window_end < NOW()
  `;

  if (expired.length === 0) {
    return 0;
  }

  const seminarIds = expired.map(e => e.id);
  const submissionIds = expired.map(e => e.submission_id);

  // Update all expired seminars to no_show
  await sql`
    UPDATE seminars
    SET status = 'no_show', ended_at = NOW()
    WHERE id = ANY(${seminarIds})
  `;

  // Revert all corresponding submissions back to reviewed
  await sql`
    UPDATE submissions
    SET status = 'reviewed'
    WHERE id = ANY(${submissionIds})
  `;

  return expired.length;
}

// Transcript queries
export async function getTranscriptsBySeminar(seminarId: string): Promise<Transcript[]> {
  const sql = getDb();
  return sql<Transcript[]>`
    SELECT * FROM transcripts WHERE seminar_id = ${seminarId} ORDER BY timestamp_ms ASC
  `;
}

export async function createTranscript(
  id: string,
  seminarId: string,
  speaker?: string,
  text?: string,
  timestampMs?: number,
  confidence?: number
): Promise<Transcript> {
  const sql = getDb();
  const result = await sql<Transcript[]>`
    INSERT INTO transcripts (id, seminar_id, speaker, text, timestamp_ms, confidence)
    VALUES (${id}, ${seminarId}, ${speaker ?? null}, ${text ?? null}, ${timestampMs ?? null}, ${confidence ?? null})
    RETURNING *
  `;
  return result[0];
}

export async function createTranscriptBatch(
  transcripts: Array<{
    id: string;
    seminarId: string;
    speaker?: string;
    text?: string;
    timestampMs?: number;
    confidence?: number;
  }>
): Promise<Transcript[]> {
  const sql = getDb();
  const values = transcripts.map((t) => ({
    id: t.id,
    seminar_id: t.seminarId,
    speaker: t.speaker ?? null,
    text: t.text ?? null,
    timestamp_ms: t.timestampMs ?? null,
    confidence: t.confidence ?? null,
  }));

  return sql<Transcript[]>`
    INSERT INTO transcripts ${sql(values)}
    RETURNING *
  `;
}

// Recording queries
export async function getRecordingBySeminar(seminarId: string): Promise<Recording | null> {
  const sql = getDb();
  const result = await sql<Recording[]>`
    SELECT * FROM recordings WHERE seminar_id = ${seminarId}
  `;
  return result[0] ?? null;
}

export async function createRecording(
  id: string,
  seminarId: string,
  audioData: Buffer,
  mimeType?: string,
  durationSeconds?: number
): Promise<Recording> {
  const sql = getDb();
  const sizeBytes = audioData.length;
  const result = await sql<Recording[]>`
    INSERT INTO recordings (id, seminar_id, audio_data, mime_type, duration_seconds, size_bytes)
    VALUES (${id}, ${seminarId}, ${audioData}, ${mimeType ?? null}, ${durationSeconds ?? null}, ${sizeBytes})
    RETURNING *
  `;
  return result[0];
}

// Grade queries
export async function getGradeById(id: string): Promise<Grade | null> {
  const sql = getDb();
  const result = await sql<Grade[]>`
    SELECT * FROM grades WHERE id = ${id}
  `;
  return result[0] ?? null;
}

export async function getGradeBySubmission(submissionId: string): Promise<Grade | null> {
  const sql = getDb();
  const result = await sql<Grade[]>`
    SELECT * FROM grades WHERE submission_id = ${submissionId}
  `;
  return result[0] ?? null;
}

export async function createGrade(
  id: string,
  submissionId: string,
  reviewedBy: string,
  reviewScore?: number,
  seminarScore?: number,
  finalGrade?: string,
  adminNotes?: string,
  studentFeedback?: string
): Promise<Grade> {
  const sql = getDb();
  const result = await sql<Grade[]>`
    INSERT INTO grades (id, submission_id, reviewed_by, review_score, seminar_score, final_grade, admin_notes, student_feedback)
    VALUES (${id}, ${submissionId}, ${reviewedBy}, ${reviewScore ?? null}, ${seminarScore ?? null}, ${finalGrade ?? null}, ${adminNotes ?? null}, ${studentFeedback ?? null})
    RETURNING *
  `;
  return result[0];
}

export async function updateGrade(
  id: string,
  updates: Partial<Pick<Grade, "review_score" | "seminar_score" | "final_grade" | "admin_notes" | "student_feedback">>
): Promise<Grade | null> {
  const sql = getDb();
  const result = await sql<Grade[]>`
    UPDATE grades
    SET
      review_score = COALESCE(${updates.review_score ?? null}, review_score),
      seminar_score = COALESCE(${updates.seminar_score ?? null}, seminar_score),
      final_grade = COALESCE(${updates.final_grade ?? null}, final_grade),
      admin_notes = COALESCE(${updates.admin_notes ?? null}, admin_notes),
      student_feedback = COALESCE(${updates.student_feedback ?? null}, student_feedback),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] ?? null;
}

// Utility: Count seminars in a slot
export async function countSeminarsInSlot(slotId: string): Promise<number> {
  const sql = getDb();
  const result = await sql<[{ count: string }]>`
    SELECT COUNT(*) as count FROM seminars
    WHERE slot_id = ${slotId} AND status NOT IN ('failed', 'no_show')
  `;
  return parseInt(result[0].count, 10);
}

// Utility: Check if student has submission for assignment
export async function hasSubmissionForAssignment(studentId: string, assignmentId: string): Promise<boolean> {
  const sql = getDb();
  const result = await sql<[{ exists: boolean }]>`
    SELECT EXISTS(
      SELECT 1 FROM submissions
      WHERE student_id = ${studentId} AND assignment_id = ${assignmentId}
    ) as exists
  `;
  return result[0].exists;
}

// Grading-specific types and queries
export interface SubmissionForGrading {
  id: string;
  student_id: string;
  assignment_id: string;
  filename: string | null;
  status: string;
  uploaded_at: Date;
  student_username: string;
  student_name: string | null;
  assignment_name: string;
  review_score: number | null;
  review_feedback: string | null;
  seminar_status: string | null;
  seminar_duration: number | null;
  grade_id: string | null;
  grade_review_score: number | null;
  grade_seminar_score: number | null;
  final_grade: string | null;
  admin_notes: string | null;
  student_feedback: string | null;
}

export async function getSubmissionsForGrading(): Promise<SubmissionForGrading[]> {
  const sql = getDb();
  return sql<SubmissionForGrading[]>`
    SELECT
      s.id,
      s.student_id,
      s.assignment_id,
      s.filename,
      s.status,
      s.uploaded_at,
      u.su_username as student_username,
      u.name as student_name,
      a.name as assignment_name,
      r.parsed_score as review_score,
      r.parsed_feedback as review_feedback,
      sem.status as seminar_status,
      sem.duration_seconds as seminar_duration,
      g.id as grade_id,
      g.review_score as grade_review_score,
      g.seminar_score as grade_seminar_score,
      g.final_grade,
      g.admin_notes,
      g.student_feedback
    FROM submissions s
    JOIN users u ON s.student_id = u.id
    JOIN assignments a ON s.assignment_id = a.id
    LEFT JOIN reviews r ON r.submission_id = s.id
    LEFT JOIN seminars sem ON sem.submission_id = s.id
    LEFT JOIN grades g ON g.submission_id = s.id
    WHERE s.status IN ('reviewed', 'seminar_pending', 'seminar_completed', 'approved', 'rejected')
    ORDER BY
      CASE s.status
        WHEN 'seminar_completed' THEN 1
        WHEN 'reviewed' THEN 2
        WHEN 'seminar_pending' THEN 3
        WHEN 'approved' THEN 4
        WHEN 'rejected' THEN 5
      END,
      s.uploaded_at DESC
  `;
}

export async function getSubmissionForGradingById(id: string): Promise<SubmissionForGrading | null> {
  const sql = getDb();
  const result = await sql<SubmissionForGrading[]>`
    SELECT
      s.id,
      s.student_id,
      s.assignment_id,
      s.filename,
      s.status,
      s.uploaded_at,
      u.su_username as student_username,
      u.name as student_name,
      a.name as assignment_name,
      r.parsed_score as review_score,
      r.parsed_feedback as review_feedback,
      sem.status as seminar_status,
      sem.duration_seconds as seminar_duration,
      g.id as grade_id,
      g.review_score as grade_review_score,
      g.seminar_score as grade_seminar_score,
      g.final_grade,
      g.admin_notes,
      g.student_feedback
    FROM submissions s
    JOIN users u ON s.student_id = u.id
    JOIN assignments a ON s.assignment_id = a.id
    LEFT JOIN reviews r ON r.submission_id = s.id
    LEFT JOIN seminars sem ON sem.submission_id = s.id
    LEFT JOIN grades g ON g.submission_id = s.id
    WHERE s.id = ${id}
  `;
  return result[0] ?? null;
}

export async function getAllGradesWithDetails(): Promise<Array<SubmissionForGrading & { reviewed_by_username: string | null }>> {
  const sql = getDb();
  return sql<Array<SubmissionForGrading & { reviewed_by_username: string | null }>>`
    SELECT
      s.id,
      s.student_id,
      s.assignment_id,
      s.filename,
      s.status,
      s.uploaded_at,
      u.su_username as student_username,
      u.name as student_name,
      a.name as assignment_name,
      r.parsed_score as review_score,
      r.parsed_feedback as review_feedback,
      sem.status as seminar_status,
      sem.duration_seconds as seminar_duration,
      g.id as grade_id,
      g.review_score as grade_review_score,
      g.seminar_score as grade_seminar_score,
      g.final_grade,
      g.admin_notes,
      g.student_feedback,
      admin.su_username as reviewed_by_username
    FROM submissions s
    JOIN users u ON s.student_id = u.id
    JOIN assignments a ON s.assignment_id = a.id
    LEFT JOIN reviews r ON r.submission_id = s.id
    LEFT JOIN seminars sem ON sem.submission_id = s.id
    LEFT JOIN grades g ON g.submission_id = s.id
    LEFT JOIN users admin ON g.reviewed_by = admin.id
    WHERE g.final_grade IS NOT NULL
    ORDER BY g.updated_at DESC
  `;
}

// Extended type for assignment with submission info
export interface AssignmentWithSubmission extends Assignment {
  submission_id: string | null;
  submission_status: string | null;
  has_booked_seminar: boolean;
  course_code: string;
  course_name: string;
}

// Get assignments where student has submissions (with booking status)
export async function getAssignmentsWithSubmissionsByStudent(studentId: string): Promise<AssignmentWithSubmission[]> {
  const sql = getDb();
  return sql<AssignmentWithSubmission[]>`
    SELECT
      a.*,
      s.id as submission_id,
      s.status as submission_status,
      c.code as course_code,
      c.name as course_name,
      EXISTS(
        SELECT 1 FROM seminars sem
        WHERE sem.submission_id = s.id
        AND sem.status NOT IN ('failed', 'no_show')
      ) as has_booked_seminar
    FROM assignments a
    INNER JOIN submissions s ON s.assignment_id = a.id
    INNER JOIN courses c ON c.id = a.course_id
    WHERE s.student_id = ${studentId}
    ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC
  `;
}

// Get seminars for a student with slot and assignment details
export interface SeminarWithDetails extends Seminar {
  assignment_name: string;
  course_code: string;
  window_start: Date;
  window_end: Date;
}

export async function getSeminarsByStudent(studentId: string): Promise<SeminarWithDetails[]> {
  const sql = getDb();
  return sql<SeminarWithDetails[]>`
    SELECT
      sem.*,
      a.name as assignment_name,
      c.code as course_code,
      ss.window_start,
      ss.window_end
    FROM seminars sem
    INNER JOIN submissions s ON s.id = sem.submission_id
    INNER JOIN seminar_slots ss ON ss.id = sem.slot_id
    INNER JOIN assignments a ON a.id = s.assignment_id
    INNER JOIN courses c ON c.id = a.course_id
    WHERE s.student_id = ${studentId}
    ORDER BY ss.window_start DESC
  `;
}

// Admin: Get all seminars with student and assignment details
export interface AdminSeminar {
  id: string;
  student_name: string;
  student_username: string;
  assignment_name: string;
  status: string;
  language: string;
  window_start: Date;
  window_end: Date;
  started_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  booked_at: Date;
}

export async function getAllSeminarsForAdmin(): Promise<AdminSeminar[]> {
  const sql = getDb();
  return sql<AdminSeminar[]>`
    SELECT
      sem.id,
      u.name as student_name,
      u.su_username as student_username,
      a.name as assignment_name,
      sem.status,
      sem.language,
      ss.window_start,
      ss.window_end,
      sem.started_at,
      sem.ended_at,
      sem.duration_seconds,
      sem.booked_at
    FROM seminars sem
    INNER JOIN submissions s ON s.id = sem.submission_id
    INNER JOIN users u ON u.id = s.student_id
    INNER JOIN assignments a ON a.id = s.assignment_id
    INNER JOIN seminar_slots ss ON ss.id = sem.slot_id
    ORDER BY ss.window_start DESC, sem.booked_at DESC
  `;
}

// Student results with all details (excludes review_feedback - admin only)
export interface StudentResult {
  submission_id: string;
  assignment_id: string;
  assignment_name: string;
  course_code: string;
  course_name: string;
  submission_status: string;
  uploaded_at: Date;
  has_review: boolean;
  seminar_status: string | null;
  seminar_duration: number | null;
  seminar_language: string | null;
  final_grade: string | null;
  student_feedback: string | null;
}

export async function getResultsByStudent(studentId: string): Promise<StudentResult[]> {
  const sql = getDb();
  return sql<StudentResult[]>`
    SELECT
      s.id as submission_id,
      s.assignment_id,
      a.name as assignment_name,
      c.code as course_code,
      c.name as course_name,
      s.status as submission_status,
      s.uploaded_at,
      (r.id IS NOT NULL) as has_review,
      sem.status as seminar_status,
      sem.duration_seconds as seminar_duration,
      sem.language as seminar_language,
      g.final_grade,
      g.student_feedback
    FROM submissions s
    INNER JOIN assignments a ON a.id = s.assignment_id
    INNER JOIN courses c ON c.id = a.course_id
    LEFT JOIN reviews r ON r.submission_id = s.id
    LEFT JOIN seminars sem ON sem.submission_id = s.id AND sem.status NOT IN ('failed', 'no_show')
    LEFT JOIN grades g ON g.submission_id = s.id
    WHERE s.student_id = ${studentId}
    ORDER BY
      CASE WHEN g.final_grade IS NOT NULL THEN 0 ELSE 1 END,
      s.uploaded_at DESC
  `;
}

// Extended type for slots with booking count
export interface SeminarSlotWithCount extends SeminarSlot {
  booked_count: number;
  spots_available: number;
}

// Get available slots with booking count
export async function getAvailableSeminarSlotsWithCount(assignmentId: string): Promise<SeminarSlotWithCount[]> {
  const sql = getDb();
  return sql<SeminarSlotWithCount[]>`
    SELECT
      ss.*,
      COALESCE((
        SELECT COUNT(*)::int FROM seminars s
        WHERE s.slot_id = ss.id AND s.status NOT IN ('failed', 'no_show')
      ), 0) as booked_count,
      ss.max_concurrent - COALESCE((
        SELECT COUNT(*)::int FROM seminars s
        WHERE s.slot_id = ss.id AND s.status NOT IN ('failed', 'no_show')
      ), 0) as spots_available
    FROM seminar_slots ss
    WHERE ss.assignment_id = ${assignmentId}
      AND ss.window_end > NOW()
    ORDER BY ss.window_start ASC
  `;
}
