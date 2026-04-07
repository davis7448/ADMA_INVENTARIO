import { NextRequest, NextResponse } from 'next/server';

// Allowed origins - add more as needed
const ALLOWED_ORIGINS = [
  'https://adma-auditoria.web.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
  'Access-Control-Max-Age': '86400',
};

export function handleCors(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  
  // Check if origin is allowed
  const isAllowed = !origin || ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || origin.includes(allowed)
  );

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
    'Access-Control-Max-Age': '86400',
  };

  if (isAllowed && origin) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else {
    headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS[0];
  }

  // Handle preflight request
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { 
      status: 204, 
      headers 
    });
  }

  return null;
}