import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes, static files, and login page
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.') ||
    pathname === '/login'
  ) {
    return NextResponse.next();
  }

  try {
    const app = await getApp();

    // If app is not properly initialized (empty object), skip authentication
    if (!app || !app.name) {
      console.warn('Firebase Admin SDK not initialized, skipping server-side auth');
      return NextResponse.next();
    }

    const auth = getAuth(app);
    const sessionCookie = request.cookies.get('__session')?.value;

    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verify the session cookie
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    // Add user info to headers for use in components
    const response = NextResponse.next();
    response.headers.set('x-user-email', decodedClaims.email || '');
    response.headers.set('x-user-role', decodedClaims.role || 'commercial');

    return response;
  } catch (error) {
    console.error('Auth middleware error:', error);
    // If authentication fails, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};