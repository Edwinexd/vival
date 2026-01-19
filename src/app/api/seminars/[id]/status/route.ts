import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getSeminarStatus, canStartSeminar } from '@/services/seminar';
import { getDb } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: seminarId } = await params;

  // Get seminar status
  const status = await getSeminarStatus(seminarId);

  if (!status) {
    return NextResponse.json({ error: 'Seminar not found' }, { status: 404 });
  }

  // Get submission details including code and assignment duration settings
  const sql = getDb();
  const submissionData = await sql`
    SELECT u.su_username, sub.file_content, sub.filename, a.name as assignment_name,
           a.target_time_minutes, a.max_time_minutes
    FROM seminars s
    JOIN submissions sub ON s.submission_id = sub.id
    JOIN users u ON sub.student_id = u.id
    JOIN assignments a ON sub.assignment_id = a.id
    WHERE s.id = ${seminarId}
  `;

  if (submissionData.length > 0 && !session.isAdmin && submissionData[0].su_username !== session.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const submission = submissionData[0] || null;

  // Get can-start status
  const canStart = await canStartSeminar(seminarId);

  return NextResponse.json({
    ...status,
    canStart: canStart.canStart,
    canStartReason: canStart.reason,
    activeCount: canStart.activeCount,
    maxConcurrent: canStart.maxConcurrent,
    targetTimeMinutes: submission?.target_time_minutes ?? 30,
    maxTimeMinutes: submission?.max_time_minutes ?? 35,
    submission: submission ? {
      filename: submission.filename,
      fileContent: submission.file_content,
      assignmentName: submission.assignment_name,
    } : null,
  });
}
