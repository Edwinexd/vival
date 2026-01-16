import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAvailableSeminarSlotsWithCount } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get('assignmentId');

  if (!assignmentId) {
    return NextResponse.json(
      { error: 'Missing assignmentId parameter' },
      { status: 400 }
    );
  }

  const slots = await getAvailableSeminarSlotsWithCount(assignmentId);

  return NextResponse.json({ slots });
}
