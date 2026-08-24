import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { genPkce, buildAuthUrl, savePendingOauth, publicOrigin, origenRegistrado } from '@/lib/dropi-mcp';

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
    const solicitado = request.nextUrl.searchParams.get('origin') || publicOrigin(request.headers, request.nextUrl.origin);
    // Dropi solo acepta los dominios registrados para nuestro client_id. Si se inicia
    // desde otro (el dominio propio, por ejemplo), se usa el canónico: de lo contrario
    // el usuario ve "invalid_redirect_uri" y no hay forma de conectar la cuenta.
    const origin = origenRegistrado(solicitado);
    const redirectUri = `${origin}/api/dropi/oauth/callback`;
    const state = crypto.randomUUID();
    const { verifier, challenge } = genPkce();
    await savePendingOauth(state, verifier, redirectUri, label, bodega, pais);
    return NextResponse.redirect(buildAuthUrl(redirectUri, state, challenge));
}
