import { NextRequest, NextResponse } from 'next/server';
import { validateApiToken, checkRateLimit, updateTokenUsage } from '@/lib/api-tokens';
import { getDispatchOrders } from '@/lib/api';
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

// Normalize tracking number for different carriers
function normalizeTrackingNumber(trackingNumber: string): string {
  const cleaned = trackingNumber.trim();
  
  // Interrapidisimo/Envía: If starts with '24' and has 11 digits, add '0' at the beginning
  if (cleaned.startsWith('24') && cleaned.length === 11) {
    return '0' + cleaned;
  }
  
  // Servientrega: If starts with '3' and has 11 digits, prepend '7' and append '001'
  if (cleaned.startsWith('3') && cleaned.length === 11) {
    return '7' + cleaned + '001';
  }
  
  return cleaned;
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

    // Fetch all dispatch orders
    const { orders: allOrders } = await getDispatchOrders({ fetchAll: true });

    // Create lookup maps for platforms and carriers
    // Note: In a production environment, you might want to cache these
    const platformNames: Record<string, string> = {};
    const carrierNames: Record<string, string> = {};

    // Build lookup maps from orders
    allOrders.forEach(order => {
      if (order.platformId && !platformNames[order.platformId]) {
        platformNames[order.platformId] = order.platformName || 'Unknown';
      }
      if (order.carrierId && !carrierNames[order.carrierId]) {
        carrierNames[order.carrierId] = order.carrierName || 'Unknown';
      }
    });

    // Process each tracking number
    const results: GuideResult[] = [];
    let found = 0;
    let notFound = 0;

    for (const originalTrackingNumber of trackingNumbers) {
      const normalizedTrackingNumber = normalizeTrackingNumber(originalTrackingNumber);
      
      const foundOrder = allOrders.find(order =>
        order.trackingNumbers?.includes(normalizedTrackingNumber) ||
        order.exceptions?.some((ex: any) => ex.trackingNumber === normalizedTrackingNumber) ||
        order.cancelledExceptions?.some((ex: any) => ex.trackingNumber === normalizedTrackingNumber)
      );

      if (foundOrder) {
        let status: string;
        
        if (foundOrder.trackingNumbers?.includes(normalizedTrackingNumber)) {
          status = foundOrder.status;
        } else if (foundOrder.exceptions?.some((ex: any) => ex.trackingNumber === normalizedTrackingNumber)) {
          status = 'Pendiente/Excepción';
        } else if (foundOrder.cancelledExceptions?.some((ex: any) => ex.trackingNumber === normalizedTrackingNumber)) {
          status = 'Anulada';
        } else {
          status = 'Desconocido';
        }

        results.push({
          trackingNumber: originalTrackingNumber,
          status,
          dispatchId: foundOrder.dispatchId,
          date: foundOrder.date?.toISOString?.() || foundOrder.date || null,
          platformName: platformNames[foundOrder.platformId] || foundOrder.platformName || null,
          carrierName: carrierNames[foundOrder.carrierId] || foundOrder.carrierName || null
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