import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByUsername, getAssignmentsWithSubmissionsByStudent, markExpiredSeminarsNoShow } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const user = await getUserByUsername(session.username);
  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // Automatically mark expired seminars as no-show before fetching assignments
  await markExpiredSeminarsNoShow();

  const assignments = await getAssignmentsWithSubmissionsByStudent(user.id);

  return NextResponse.json({ assignments });
}
