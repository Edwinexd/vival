import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByUsername, getSeminarsByStudent } from '@/lib/db/queries';

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

  const seminars = await getSeminarsByStudent(user.id);

  return NextResponse.json({ seminars });
}
