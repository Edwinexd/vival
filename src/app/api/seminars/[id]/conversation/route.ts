import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getDb } from '@/lib/db';

/**
 * Update the conversation_id for a seminar after WebSocket connects
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookies();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: seminarId } = await params;

  const body = await request.json();
  const { conversationId } = body;

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
  }

  const sql = getDb();

  // Verify the seminar belongs to this student (or user is admin)
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

  // Only allow updating if seminar is in_progress
  if (seminar.status !== 'in_progress') {
    return NextResponse.json(
      { error: 'Can only set conversation ID for in-progress seminars' },
      { status: 400 }
    );
  }

  // Update the conversation_id
  await sql`
    UPDATE seminars
    SET elevenlabs_conversation_id = ${conversationId}
    WHERE id = ${seminarId}
  `;

  console.log(`Seminar ${seminarId} conversation ID set to: ${conversationId}`);

  return NextResponse.json({ success: true });
}
