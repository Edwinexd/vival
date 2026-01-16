import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getTranscriptsBySeminar } from '@/lib/db/queries';

interface TranscriptResponse {
  seminarId: string;
  studentName: string;
  studentId: string;
  assignmentName: string;
  language: string;
  duration: number;
  startedAt: string | null;
  endedAt: string | null;
  entries: Array<{
    id: string;
    role: string;
    text: string;
    timestamp_ms: number;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getSessionFromCookies();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: seminarId } = await params;
  const sql = getDb();

  // Get seminar with related data
  const seminars = await sql`
    SELECT
      sem.id,
      sem.language,
      sem.duration_seconds,
      sem.started_at,
      sem.ended_at,
      sem.status,
      u.name as student_name,
      u.su_username as student_username,
      u.id as student_id,
      a.name as assignment_name
    FROM seminars sem
    JOIN submissions sub ON sem.submission_id = sub.id
    JOIN users u ON sub.student_id = u.id
    JOIN assignments a ON sub.assignment_id = a.id
    WHERE sem.id = ${seminarId}
  `;

  if (seminars.length === 0) {
    return NextResponse.json({ error: 'Seminar not found' }, { status: 404 });
  }

  const seminar = seminars[0];

  // Get transcript entries
  const transcripts = await getTranscriptsBySeminar(seminarId);

  const response: TranscriptResponse = {
    seminarId: seminar.id,
    studentName: seminar.student_name || seminar.student_username,
    studentId: seminar.student_username,
    assignmentName: seminar.assignment_name,
    language: seminar.language,
    duration: seminar.duration_seconds || 0,
    startedAt: seminar.started_at?.toISOString() || null,
    endedAt: seminar.ended_at?.toISOString() || null,
    entries: transcripts.map(t => ({
      id: t.id,
      role: t.speaker === 'agent' ? 'agent' : 'user',
      text: t.text || '',
      timestamp_ms: t.timestamp_ms || 0,
    })),
  };

  return NextResponse.json(response);
}
