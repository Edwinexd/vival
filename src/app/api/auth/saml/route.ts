import { NextRequest, NextResponse } from 'next/server';
import { createSession, getCookieName, isAdmin } from '@/lib/auth';

// Extract username from eppn (e.g., "edsu8469@su.se" -> "edsu8469")
function extractUsername(eppn: string): string | null {
  if (!eppn) return null;
  const match = eppn.match(/^([a-zA-Z0-9]+)@/);
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  // Read SAML attributes from Apache headers
  const eppn = request.headers.get('x-shib-eppn') || request.headers.get('x-remote-user');

  if (!eppn) {
    // No SAML session - redirect to Shibboleth login
    const baseUrl = process.env.BASE_URL || 'https://prog2review.dsv.su.se';
    return NextResponse.redirect(`${baseUrl}/Shibboleth.sso/Login?target=${encodeURIComponent(baseUrl + '/api/auth/saml')}`);
  }

  const username = extractUsername(eppn);

  if (!username) {
    return NextResponse.json(
      { error: 'Invalid SAML response: could not extract username from eppn' },
      { status: 400 }
    );
  }

  // Create JWT session
  const token = await createSession(username);
  const userIsAdmin = isAdmin(username);

  // Redirect to appropriate page
  const redirectUrl = userIsAdmin ? '/admin' : '/';
  const baseUrl = process.env.BASE_URL || 'https://prog2review.dsv.su.se';

  const response = NextResponse.redirect(`${baseUrl}${redirectUrl}`);

  response.cookies.set(getCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });

  return response;
}
