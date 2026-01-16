import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getSubmissionsForGrading,
  getGradeBySubmission,
  createGrade,
  updateGrade,
  updateSubmissionStatus,
  getUserByUsername,
} from "@/lib/db/queries";
import { generateId } from "@/lib/id";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submissions = await getSubmissionsForGrading();
  return NextResponse.json({ submissions });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    submission_id,
    review_score,
    seminar_score,
    final_grade,
    admin_notes,
    student_feedback,
    update_status,
  } = body;

  if (!submission_id) {
    return NextResponse.json(
      { error: "submission_id is required" },
      { status: 400 }
    );
  }

  const admin = await getUserByUsername(session.username);
  if (!admin) {
    return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
  }

  const existingGrade = await getGradeBySubmission(submission_id);

  let grade;
  if (existingGrade) {
    grade = await updateGrade(existingGrade.id, {
      review_score: review_score ?? undefined,
      seminar_score: seminar_score ?? undefined,
      final_grade: final_grade ?? undefined,
      admin_notes: admin_notes ?? undefined,
      student_feedback: student_feedback ?? undefined,
    });
  } else {
    const gradeId = await generateId();
    grade = await createGrade(
      gradeId,
      submission_id,
      admin.id,
      review_score ?? undefined,
      seminar_score ?? undefined,
      final_grade ?? undefined,
      admin_notes ?? undefined,
      student_feedback ?? undefined
    );
  }

  if (update_status && final_grade) {
    const newStatus = final_grade === "F" ? "rejected" : "approved";
    await updateSubmissionStatus(submission_id, newStatus);
  }

  return NextResponse.json({ grade });
}
