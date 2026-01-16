import { NextRequest, NextResponse } from 'next/server';
import { createSession, getCookieName, isAdmin } from '@/lib/auth';

const USERNAME_REGEX = /^[a-zA-Z0-9]{4,20}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 4-20 alphanumeric characters' },
        { status: 400 }
      );
    }

    const token = await createSession(username);
    const userIsAdmin = isAdmin(username);

    const response = NextResponse.json({
      username,
      isAdmin: userIsAdmin,
    });

    response.cookies.set(getCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
