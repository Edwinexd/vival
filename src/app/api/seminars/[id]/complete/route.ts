import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { completeSeminar } from '@/services/seminar';
import { getConversationStatus } from '@/lib/elevenlabs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Client-side fallback for completing a seminar when webhooks aren't available.
 * This is called when the WebSocket connection ends on the client.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: seminarId } = await params;
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getDb();

  // Get seminar to verify ownership
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

  // Verify ownership (student or admin)
  if (!session.isAdmin && seminar.su_username !== session.username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse request body first
  const body = await request.json().catch(() => ({}));
  const clientStatus = body.status === 'ended' ? 'completed' : 'failed';
  const clientDuration = body.duration || 0;

  console.log(`[Complete] Seminar ${seminarId}: client reported status=${body.status}, duration=${clientDuration}`);

  // Only process if seminar is still in_progress (webhook might have already handled it)
  if (seminar.status !== 'in_progress') {
    return NextResponse.json({
      success: true,
      message: 'Seminar already completed',
      status: seminar.status,
    });
  }

  const conversationId = seminar.elevenlabs_conversation_id;

  // If client reported error/failure, mark as failed and reset submission status
  if (clientStatus === 'failed') {
    await sql`
      UPDATE seminars
      SET status = 'failed', ended_at = NOW(), duration_seconds = ${clientDuration}
      WHERE id = ${seminarId}
    `;
    // Reset submission so student can try again
    await sql`
      UPDATE submissions
      SET status = 'reviewed'
      WHERE id = ${seminar.submission_id}
    `;
    console.log(`[Complete] Seminar ${seminarId} marked as failed, submission reset to reviewed`);
    return NextResponse.json({
      success: true,
      message: 'Seminar marked as failed',
      status: 'failed',
    });
  }

  if (!conversationId) {
    // No conversation ID but client said 'ended' - unusual, mark as failed
    await sql`
      UPDATE seminars
      SET status = 'failed', ended_at = NOW()
      WHERE id = ${seminarId}
    `;
    await sql`
      UPDATE submissions
      SET status = 'reviewed'
      WHERE id = ${seminar.submission_id}
    `;
    return NextResponse.json({
      success: true,
      message: 'Seminar marked as failed (no conversation)',
      status: 'failed',
    });
  }

  // Try to get conversation status from ElevenLabs
  try {
    const convStatus = await getConversationStatus(conversationId);
    console.log(`[Complete] Conversation ${conversationId} status from ElevenLabs:`, convStatus);

    // Complete the seminar with the status from ElevenLabs
    const status = convStatus.status === 'completed' ? 'completed' : 'failed';
    const duration = convStatus.duration_seconds || clientDuration;

    await completeSeminar(conversationId, status, duration);

    return NextResponse.json({
      success: true,
      message: `Seminar completed via client fallback`,
      status,
      duration,
    });
  } catch (error) {
    console.error('[Complete] Failed to get conversation status from ElevenLabs:', error);

    // Mark as completed based on client status
    await completeSeminar(conversationId, clientStatus, clientDuration);

    return NextResponse.json({
      success: true,
      message: 'Seminar completed via client fallback (ElevenLabs unreachable)',
      status: clientStatus,
      duration: clientDuration,
    });
  }
}
