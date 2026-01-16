import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markSeminarNoShow } from "@/lib/db/queries";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: seminarId } = await params;

  try {
    const result = await markSeminarNoShow(seminarId);

    if (!result) {
      return NextResponse.json(
        { error: "Seminar not found or cannot be marked as no-show (must be in booked/waiting status)" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Seminar marked as no-show",
      seminarId: result.seminar.id,
      submissionId: result.submissionId,
    });
  } catch (err) {
    console.error("Failed to mark seminar as no-show:", err);
    return NextResponse.json(
      { error: "Failed to mark seminar as no-show" },
      { status: 500 }
    );
  }
}
