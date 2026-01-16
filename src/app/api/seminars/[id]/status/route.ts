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

  // Verify ownership (unless admin)
  const sql = getDb();
  const ownership = await sql`
    SELECT u.su_username
    FROM seminars s
    JOIN submissions sub ON s.submission_id = sub.id
    JOIN users u ON sub.student_id = u.id
    WHERE s.id = ${seminarId}
  `;

  if (ownership.length > 0 && !session.isAdmin && ownership[0].su_username !== session.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get can-start status
  const canStart = await canStartSeminar(seminarId);

  return NextResponse.json({
    ...status,
    canStart: canStart.canStart,
    canStartReason: canStart.reason,
    activeCount: canStart.activeCount,
    maxConcurrent: canStart.maxConcurrent,
  });
}
