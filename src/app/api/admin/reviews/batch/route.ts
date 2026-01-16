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
    const { submissionIds } = body;

    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return NextResponse.json({ error: "submissionIds array is required" }, { status: 400 });
    }

    if (submissionIds.length > 500) {
      return NextResponse.json({ error: "Maximum 500 submissions per batch" }, { status: 400 });
    }

    const results: Array<{
      submissionId: string;
      success: boolean;
      reviewId?: string;
      score?: number;
      error?: string;
    }> = [];

    for (const submissionId of submissionIds) {
      if (typeof submissionId !== "string") {
        results.push({ submissionId: String(submissionId), success: false, error: "Invalid ID" });
        continue;
      }

      const canStart = await canStartReview(submissionId);
      if (!canStart.allowed) {
        results.push({ submissionId, success: false, error: canStart.reason });
        continue;
      }

      const result = await processSubmissionReview(submissionId);

      if (result.success && result.review) {
        results.push({
          submissionId,
          success: true,
          reviewId: result.review.id,
          score: result.review.parsed_score ?? undefined,
        });
      } else {
        results.push({
          submissionId,
          success: false,
          error: result.error,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      total: submissionIds.length,
      succeeded: successCount,
      failed: failCount,
      results,
    });
  } catch (err) {
    console.error("Batch review error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Batch review failed" },
      { status: 500 }
    );
  }
}
