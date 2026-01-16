import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: seminarId } = await params;
  const sql = getDb();

  try {
    const seminars = await sql`
      SELECT
        s.id,
        s.status,
        s.language,
        s.elevenlabs_conversation_id as conversation_id,
        s.booked_at,
        s.started_at,
        s.ended_at,
        s.duration_seconds,
        u.name as student_name,
        u.su_username as student_username,
        a.id as assignment_id,
        a.name as assignment_name,
        sub.id as submission_id,
        slot.window_start,
        slot.window_end
      FROM seminars s
      JOIN submissions sub ON s.submission_id = sub.id
      JOIN users u ON sub.student_id = u.id
      JOIN assignments a ON sub.assignment_id = a.id
      JOIN seminar_slots slot ON s.slot_id = slot.id
      WHERE s.id = ${seminarId}
    `;

    if (seminars.length === 0) {
      return NextResponse.json({ error: "Seminar not found" }, { status: 404 });
    }

    const seminar = seminars[0];

    return NextResponse.json({
      id: seminar.id,
      status: seminar.status,
      language: seminar.language,
      conversationId: seminar.conversation_id,
      studentName: seminar.student_name,
      studentUsername: seminar.student_username,
      assignmentId: seminar.assignment_id,
      assignmentName: seminar.assignment_name,
      submissionId: seminar.submission_id,
      windowStart: seminar.window_start,
      windowEnd: seminar.window_end,
      startedAt: seminar.started_at,
      endedAt: seminar.ended_at,
      durationSeconds: seminar.duration_seconds,
      bookedAt: seminar.booked_at,
    });
  } catch (err) {
    console.error("Failed to fetch seminar:", err);
    return NextResponse.json(
      { error: "Failed to fetch seminar" },
      { status: 500 }
    );
  }
}
