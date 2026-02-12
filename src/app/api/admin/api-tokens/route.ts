import { NextRequest, NextResponse } from 'next/server';
import { createApiToken, listApiTokens, revokeApiToken } from '@/lib/api-tokens';

// Simple admin check - in production, use proper authentication
const ADMIN_EMAILS = ['admin@adma.com', 'davis@adma.com'];

function isAdmin(request: NextRequest): boolean {
  // In a real implementation, check session/cookies
  // For now, allow from localhost or check a header
  const adminKey = request.headers.get('X-Admin-Key');
  return adminKey === process.env.ADMIN_API_KEY || process.env.NODE_ENV === 'development';
}

// GET - List all tokens
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokens = await listApiTokens();
    return NextResponse.json({ success: true, tokens });
  } catch (error) {
    console.error('Error listing tokens:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

// POST - Create new token
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientName, clientId, allowedOrigins, rateLimitPerMinute = 100, createdBy = 'admin' } = body;

    if (!clientName || !clientId) {
      return NextResponse.json(
        { success: false, error: 'clientName and clientId are required' },
        { status: 400 }
      );
    }

    const result = await createApiToken(
      clientName,
      clientId,
      createdBy,
      allowedOrigins || [],
      rateLimitPerMinute
    );

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        token: result.token,
        message: 'Token created successfully' 
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating token:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

// DELETE - Revoke token
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    const result = await revokeApiToken(token);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Token revoked' });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error revoking token:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}