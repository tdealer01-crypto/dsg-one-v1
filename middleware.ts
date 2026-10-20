import { NextResponse, type NextRequest } from 'next/server';

function isJwtStructurallyValid(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

const PROTECTED_PREFIXES = ['/dsg', '/enterprise', '/generated-apps'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The human approver page is a public OAuth callback landing page.
  // No data/decision authority is granted here: all approval APIs verify a
  // dedicated signed Auth0 JWT and AWS enforces ownership + signed MFA.
  // Requiring a Supabase site cookie here destroys the OAuth code/state.
  if (pathname === '/dsg/approvals' || pathname === '/dsg/approvals/') {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Supabase access token cookie (may be prefixed with project ref)
  const accessToken =
    // Try common Supabase cookie patterns
    [...request.cookies.getAll()].find(
      (c) =>
        c.name.endsWith('-auth-token') ||
        c.name === 'sb-access-token' ||
        c.name.includes('auth-token')
    )?.value;

  if (accessToken && isJwtStructurallyValid(accessToken)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  // Preserve the user's protected destination (including ?tool=browser) through sign-in.
  // The pathname is already same-origin and in the protected prefix allowlist.
  url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/dsg/:path*', '/enterprise/:path*', '/generated-apps/:path*'],
};
