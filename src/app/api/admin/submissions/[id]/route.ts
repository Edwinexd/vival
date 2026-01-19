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
  seminar_id: string | null;
  seminar_status: string | null;
  ai_grade_status: string | null;
  ai_suggested_score: number | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const sql = getDb();
    const submissions = await sql<SubmissionWithDetails[]>`
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
        EXISTS(SELECT 1 FROM seminars sem WHERE sem.submission_id = s.id) as has_seminar,
        sem.id as seminar_id,
        sem.status as seminar_status,
        ag.status as ai_grade_status,
        ag.suggested_score as ai_suggested_score
      FROM submissions s
      JOIN users u ON s.student_id = u.id
      JOIN assignments a ON s.assignment_id = a.id
      JOIN courses c ON c.id = a.course_id
      LEFT JOIN reviews r ON r.submission_id = s.id
      LEFT JOIN seminars sem ON sem.submission_id = s.id
      LEFT JOIN ai_grades ag ON ag.submission_id = s.id
      WHERE s.id = ${id}
    `;

    if (submissions.length === 0) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({ submission: submissions[0] });
  } catch (err) {
    console.error('Failed to fetch submission:', err);
    return NextResponse.json(
      { error: 'Failed to fetch submission' },
      { status: 500 }
    );
  }
}
