import { NextRequest, NextResponse } from 'next/server';
import { createSession, getCookieName, isAdmin } from '@/lib/auth';

// Validate eppn format (e.g., "bbohm@SU.SE" or "edsu8469@su.se")
// Returns the full eppn if valid, null otherwise
function validateEppn(eppn: string): string | null {
  if (!eppn) return null;
  // Must be username@domain format
  const match = eppn.match(/^[a-zA-Z0-9]+@[a-zA-Z0-9.]+$/);
  return match ? eppn : null;
}

export async function GET(request: NextRequest) {
  // Read SAML attributes from Apache headers (hardcoded header name)
  const eppn = request.headers.get('x-shib-eppn') || request.headers.get('x-remote-user');

  if (!eppn) {
    // No SAML session - redirect to Shibboleth login
    const baseUrl = process.env.BASE_URL || 'https://prog2review.dsv.su.se';
    return NextResponse.redirect(`${baseUrl}/Shibboleth.sso/Login?target=${encodeURIComponent(baseUrl + '/api/auth/saml')}`);
  }

  const username = validateEppn(eppn);

  if (!username) {
    return NextResponse.json(
      { error: 'Invalid SAML response: eppn must be in username@domain format' },
      { status: 400 }
    );
  }

  // Create JWT session with full eppn (e.g., "bbohm@SU.SE")
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
