import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getReviewBySubmission, getSubmissionById } from "@/lib/db/queries";
import { getCondensedDiscussionPlan, type DiscussionPoint } from "@/lib/openai";

interface Params {
  params: Promise<{ submissionId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { submissionId } = await params;

    const submission = await getSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const review = await getReviewBySubmission(submissionId);
    if (!review) {
      return NextResponse.json({ error: "No review found for this submission" }, { status: 404 });
    }

    const discussionPlan = review.discussion_plan as DiscussionPoint[] | null;

    return NextResponse.json({
      id: review.id,
      submissionId: review.submission_id,
      model: review.gpt_model,
      score: review.parsed_score,
      feedback: review.parsed_feedback,
      issues: review.issues_found,
      discussionPlan: discussionPlan,
      condensedDiscussionPlan: discussionPlan ? getCondensedDiscussionPlan(discussionPlan) : null,
      createdAt: review.created_at,
      submission: {
        id: submission.id,
        filename: submission.filename,
        file_content: submission.file_content,
        status: submission.status,
        compile_success: submission.compile_success,
        compile_errors: submission.compile_errors,
      },
    });
  } catch (err) {
    console.error("Get review error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get review" },
      { status: 500 }
    );
  }
}
