import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const COOKIE_NAME = 'auth_session';
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production'
);

export interface Session {
  username: string;
  isAdmin: boolean;
  exp: number;
}

export function isAdmin(username: string): boolean {
  const adminUsernames = process.env.ADMIN_USERNAMES || '';
  const admins = adminUsernames.split(',').map((u) => u.trim().toLowerCase());
  return admins.includes(username.toLowerCase());
}

export async function createSession(username: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
  const token = await new SignJWT({
    username,
    isAdmin: isAdmin(username),
    exp,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return token;
}

export async function getSession(request: NextRequest): Promise<Session | null> {
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

export async function getSessionFromCookies(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
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

export function getCookieName(): string {
  return COOKIE_NAME;
}
