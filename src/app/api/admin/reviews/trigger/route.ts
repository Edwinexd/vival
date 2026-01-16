import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { processSubmissionReview, canStartReview } from "@/services/reviewService";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { submissionId } = body;

    if (!submissionId || typeof submissionId !== "string") {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }

    const canStart = await canStartReview(submissionId);
    if (!canStart.allowed) {
      return NextResponse.json({ error: canStart.reason }, { status: 400 });
    }

    const result = await processSubmissionReview(submissionId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      review: {
        id: result.review!.id,
        score: result.review!.parsed_score,
        feedback: result.review!.parsed_feedback,
        issuesCount: Array.isArray(result.review!.issues_found)
          ? (result.review!.issues_found as unknown[]).length
          : 0,
        discussionPointsCount: Array.isArray(result.review!.discussion_plan)
          ? (result.review!.discussion_plan as unknown[]).length
          : 0,
      },
    });
  } catch (err) {
    console.error("Review trigger error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Review failed" },
      { status: 500 }
    );
  }
}
