import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSeminarById, getAiGradeBySeminar } from "@/lib/db/queries";
import { retryGrading } from "@/services/gradingService";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: seminarId } = await params;

    const seminar = await getSeminarById(seminarId);
    if (!seminar) {
      return NextResponse.json({ error: "Seminar not found" }, { status: 404 });
    }

    const aiGrade = await getAiGradeBySeminar(seminarId);
    if (!aiGrade) {
      return NextResponse.json({
        seminarId,
        status: "not_started",
        message: "AI grading has not been started for this seminar",
      });
    }

    return NextResponse.json({
      id: aiGrade.id,
      seminarId: aiGrade.seminar_id,
      submissionId: aiGrade.submission_id,
      status: aiGrade.status,
      scores: {
        strict: aiGrade.score_1,
        balanced: aiGrade.score_2,
        generous: aiGrade.score_3,
      },
      reasonings: {
        strict: aiGrade.reasoning_1,
        balanced: aiGrade.reasoning_2,
        generous: aiGrade.reasoning_3,
      },
      suggestedScore: aiGrade.suggested_score,
      scoringMethod: aiGrade.scoring_method,
      errorMessage: aiGrade.error_message,
      startedAt: aiGrade.started_at,
      completedAt: aiGrade.completed_at,
      createdAt: aiGrade.created_at,
    });
  } catch (err) {
    console.error("Get AI grade error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get AI grade" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: seminarId } = await params;

    const seminar = await getSeminarById(seminarId);
    if (!seminar) {
      return NextResponse.json({ error: "Seminar not found" }, { status: 404 });
    }

    if (seminar.status !== "completed") {
      return NextResponse.json(
        { error: "Seminar must be completed before grading" },
        { status: 400 }
      );
    }

    const result = await retryGrading(seminarId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Grading failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      aiGrade: result.aiGrade ? {
        id: result.aiGrade.id,
        status: result.aiGrade.status,
        suggestedScore: result.aiGrade.suggested_score,
      } : null,
    });
  } catch (err) {
    console.error("Retry grading error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to retry grading" },
      { status: 500 }
    );
  }
}
