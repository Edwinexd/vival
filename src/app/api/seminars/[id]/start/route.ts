import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { startSeminar, canStartSeminar } from '@/services/seminar';
import { getDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: seminarId } = await params;

  // Verify the seminar belongs to this student (or user is admin)
  const sql = getDb();
  const seminars = await sql`
    SELECT s.*, sub.student_id, u.su_username
    FROM seminars s
    JOIN submissions sub ON s.submission_id = sub.id
    JOIN users u ON sub.student_id = u.id
    WHERE s.id = ${seminarId}
  `;

  if (seminars.length === 0) {
    return NextResponse.json({ error: 'Seminar not found' }, { status: 404 });
  }

  const seminar = seminars[0];

  // Check ownership (unless admin)
  if (!session.isAdmin && seminar.su_username !== session.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check if can start
  const canStart = await canStartSeminar(seminarId);

  if (!canStart.canStart) {
    return NextResponse.json({
      error: canStart.reason,
      activeCount: canStart.activeCount,
      maxConcurrent: canStart.maxConcurrent,
    }, { status: 400 });
  }

  // Start the seminar
  const result = await startSeminar(seminarId);

  if (!result.success) {
    console.error(`Failed to start seminar ${seminarId}:`, result.error);
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  console.log(`Seminar ${seminarId} started successfully`);

  return NextResponse.json({
    signedUrl: result.signedUrl,
    configOverride: result.configOverride,
  });
}
