import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';

interface SubmissionWithDetails {
  id: string;
  student_id: string;
  assignment_id: string;
  filename: string | null;
  status: string;
  uploaded_at: Date;
  student_username: string;
  student_name: string | null;
  assignment_name: string;
  course_code: string;
  review_score: number | null;
  has_seminar: boolean;
}

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const assignmentId = searchParams.get('assignmentId');

  try {
    const sql = getDb();
    let submissions: SubmissionWithDetails[];

    if (status && assignmentId) {
      submissions = await sql<SubmissionWithDetails[]>`
        SELECT
          s.id,
          s.student_id,
          s.assignment_id,
          s.filename,
          s.status,
          s.uploaded_at,
          u.su_username as student_username,
          u.name as student_name,
          a.name as assignment_name,
          c.code as course_code,
          r.parsed_score as review_score,
          EXISTS(SELECT 1 FROM seminars sem WHERE sem.submission_id = s.id) as has_seminar
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        JOIN assignments a ON s.assignment_id = a.id
        JOIN courses c ON c.id = a.course_id
        LEFT JOIN reviews r ON r.submission_id = s.id
        WHERE s.status = ${status} AND s.assignment_id = ${assignmentId}
        ORDER BY s.uploaded_at DESC
      `;
    } else if (status) {
      submissions = await sql<SubmissionWithDetails[]>`
        SELECT
          s.id,
          s.student_id,
          s.assignment_id,
          s.filename,
          s.status,
          s.uploaded_at,
          u.su_username as student_username,
          u.name as student_name,
          a.name as assignment_name,
          c.code as course_code,
          r.parsed_score as review_score,
          EXISTS(SELECT 1 FROM seminars sem WHERE sem.submission_id = s.id) as has_seminar
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        JOIN assignments a ON s.assignment_id = a.id
        JOIN courses c ON c.id = a.course_id
        LEFT JOIN reviews r ON r.submission_id = s.id
        WHERE s.status = ${status}
        ORDER BY s.uploaded_at DESC
      `;
    } else if (assignmentId) {
      submissions = await sql<SubmissionWithDetails[]>`
        SELECT
          s.id,
          s.student_id,
          s.assignment_id,
          s.filename,
          s.status,
          s.uploaded_at,
          u.su_username as student_username,
          u.name as student_name,
          a.name as assignment_name,
          c.code as course_code,
          r.parsed_score as review_score,
          EXISTS(SELECT 1 FROM seminars sem WHERE sem.submission_id = s.id) as has_seminar
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        JOIN assignments a ON s.assignment_id = a.id
        JOIN courses c ON c.id = a.course_id
        LEFT JOIN reviews r ON r.submission_id = s.id
        WHERE s.assignment_id = ${assignmentId}
        ORDER BY s.uploaded_at DESC
      `;
    } else {
      submissions = await sql<SubmissionWithDetails[]>`
        SELECT
          s.id,
          s.student_id,
          s.assignment_id,
          s.filename,
          s.status,
          s.uploaded_at,
          u.su_username as student_username,
          u.name as student_name,
          a.name as assignment_name,
          c.code as course_code,
          r.parsed_score as review_score,
          EXISTS(SELECT 1 FROM seminars sem WHERE sem.submission_id = s.id) as has_seminar
        FROM submissions s
        JOIN users u ON s.student_id = u.id
        JOIN assignments a ON s.assignment_id = a.id
        JOIN courses c ON c.id = a.course_id
        LEFT JOIN reviews r ON r.submission_id = s.id
        ORDER BY s.uploaded_at DESC
      `;
    }

    return NextResponse.json({ submissions });
  } catch (err) {
    console.error('Failed to fetch submissions:', err);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}
