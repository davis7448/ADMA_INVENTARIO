import { NextRequest, NextResponse } from 'next/server';
import { validateApiToken, checkRateLimit, updateTokenUsage } from '@/lib/api-tokens';
import { searchDispatchGuides, getPlatforms, getCarriers } from '@/lib/api';
import { corsHeaders, handleCors } from '@/lib/cors';

// CORS configuration
export async function OPTIONS(request: NextRequest) {
  return handleCors(request);
}

interface SearchRequest {
  trackingNumbers: string[];
}

interface GuideResult {
  trackingNumber: string;
  status: string;
  dispatchId: string | null;
  date: string | null;
  platformName: string | null;
  carrierName: string | null;
}

export async function POST(request: NextRequest) {
  try {
    // Handle CORS
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    // Get API token from header
    const token = request.headers.get('X-API-Token');
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing X-API-Token header' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Validate token
    const validation = await validateApiToken(token);
    
    if (!validation.valid || !validation.token) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Invalid token' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Check origin
    const origin = request.headers.get('origin');
    if (origin && validation.token.allowedOrigins.length > 0) {
      const isAllowed = validation.token.allowedOrigins.some(
        allowed => origin === allowed || origin.includes(allowed)
      );
      
      if (!isAllowed) {
        return NextResponse.json(
          { success: false, error: 'Origin not allowed' },
          { status: 403, headers: corsHeaders }
        );
      }
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(token, validation.token.rateLimitPerMinute);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000)
        },
        { status: 429, headers: corsHeaders }
      );
    }

    // Parse request body
    let body: SearchRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { trackingNumbers } = body;

    // Validate tracking numbers
    if (!Array.isArray(trackingNumbers) || trackingNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'trackingNumbers must be a non-empty array' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (trackingNumbers.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 tracking numbers per request' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Búsqueda por guía. Antes esta ruta leía la colección completa de despachos
    // (~30.000 órdenes, ~26 MB) en CADA llamada, lo que agotaba la memoria de la
    // instancia y devolvía 503. searchDispatchGuides consulta solo las guías pedidas.
    const [matches, platforms, carriers] = await Promise.all([
      searchDispatchGuides(trackingNumbers),
      getPlatforms(),
      getCarriers(),
    ]);

    // Los nombres se sacan de sus catálogos: el documento de despacho solo guarda ids,
    // así que el mapa que se armaba a partir de las órdenes devolvía siempre 'Unknown'.
    const platformNames: Record<string, string> = Object.fromEntries(platforms.map(p => [p.id, p.name]));
    const carrierNames: Record<string, string> = Object.fromEntries(carriers.map(c => [c.id, c.name]));

    const results: GuideResult[] = [];
    let found = 0;
    let notFound = 0;

    for (const originalTrackingNumber of trackingNumbers) {
      const match = matches[originalTrackingNumber];

      if (match) {
        results.push({
          trackingNumber: originalTrackingNumber,
          status: match.status,
          dispatchId: match.dispatchId,
          date: match.date,
          platformName: platformNames[match.platformId] || null,
          carrierName: carrierNames[match.carrierId] || null
        });
        found++;
      } else {
        results.push({
          trackingNumber: originalTrackingNumber,
          status: 'No encontrada',
          dispatchId: null,
          date: null,
          platformName: null,
          carrierName: null
        });
        notFound++;
      }
    }

    // Update token usage
    await updateTokenUsage(token);

    // Return response
    return NextResponse.json({
      success: true,
      clientName: validation.token.clientName,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        totalRequested: trackingNumbers.length,
        found,
        notFound
      },
      rateLimit: {
        remaining: rateLimit.remaining,
        resetTime: rateLimit.resetTime.toISOString()
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error in search-guides API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}