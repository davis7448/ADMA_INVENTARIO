import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    const app = await getApp();

    // If app is not properly initialized, skip session creation
    if (!app || !app.name) {
      console.warn('Firebase Admin SDK not initialized, skipping session creation');
      return Response.json({ success: true });
    }

    const auth = getAuth(app);

    // Create session cookie
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: 60 * 60 * 24 * 5 * 1000, // 5 days
    });

    // Set the cookie
    const cookieStore = await cookies();
    cookieStore.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 5, // 5 days
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error setting session:', error);
    return Response.json({ error: 'Failed to set session' }, { status: 500 });
  }
}