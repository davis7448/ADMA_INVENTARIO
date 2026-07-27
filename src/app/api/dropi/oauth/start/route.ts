import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { genPkce, buildAuthUrl, savePendingOauth, publicOrigin } from '@/lib/dropi-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Inicia el flujo OAuth para AGREGAR una cuenta Dropi. Se puede pasar ?label=NombreCuenta.
// Genera PKCE + state, los guarda, y redirige al login de Dropi.
export async function GET(request: NextRequest) {
    const label = request.nextUrl.searchParams.get('label') || '';
    const bodega = request.nextUrl.searchParams.get('bodega') || '';
    const pais = request.nextUrl.searchParams.get('pais') || '';
    // El origin público lo pasa el navegador (?origin=); el host del servidor en
    // Cloud Run es interno (0.0.0.0). Fallback a x-forwarded-* si no viene.
    const origin = request.nextUrl.searchParams.get('origin') || publicOrigin(request.headers, request.nextUrl.origin);
    const redirectUri = `${origin}/api/dropi/oauth/callback`;
    const state = crypto.randomUUID();
    const { verifier, challenge } = genPkce();
    await savePendingOauth(state, verifier, redirectUri, label, bodega, pais);
    return NextResponse.redirect(buildAuthUrl(redirectUri, state, challenge));
}
