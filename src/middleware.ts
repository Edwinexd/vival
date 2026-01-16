import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'auth_session';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production'
);

interface SessionPayload {
  username: string;
  isAdmin: boolean;
  exp: number;
}

async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      username: payload.username as string,
      isAdmin: payload.isAdmin as boolean,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes - no auth required
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Webhook endpoint - no auth required (has its own signature validation)
  if (pathname === '/api/seminars/webhook') {
    return NextResponse.next();
  }

  // API routes that need auth
  if (pathname.startsWith('/api/')) {
    const session = await getSession(request);

    // Admin API routes
    if (pathname.startsWith('/api/admin/')) {
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!session.isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Student API routes
    if (pathname.startsWith('/api/student/')) {
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    return NextResponse.next();
  }

  // Page routes that need auth
  const session = await getSession(request);

  // Admin pages
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (!session.isAdmin) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Student pages (root and other authenticated pages)
  if (pathname === '/' || pathname.startsWith('/book-seminar') || pathname.startsWith('/results') || pathname.startsWith('/seminar')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
};
