import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, takePendingOauth, saveDropiAccount, publicOrigin } from '@/lib/dropi-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Callback OAuth de Dropi: intercambia el code por tokens y guarda el refresh_token
// de la cuenta. Vuelve a /ventas-plataformas con el resultado.
export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    // El pending guarda el redirectUri con el origin público → base para volver.
    const pending = state ? await takePendingOauth(state) : null;
    const base = pending?.redirectUri?.replace(/\/api\/dropi\/oauth\/callback$/, '')
        || publicOrigin(request.headers, request.nextUrl.origin);
    const back = (params: string) => NextResponse.redirect(`${base}/ventas-plataformas?${params}`);

    if (error) return back(`dropi=error&msg=${encodeURIComponent(error)}`);
    if (!code || !state) return back('dropi=error&msg=faltan_parametros');
    if (!pending) return back('dropi=error&msg=estado_invalido');

    try {
        const tokens = await exchangeCode(code, pending.redirectUri, pending.verifier);
        if (!tokens.refresh_token) return back('dropi=error&msg=sin_refresh_token');

        const label = pending.label?.trim() || `Cuenta ${new Date().toISOString().slice(0, 10)}`;
        const accountId = label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || `DROPI_${Date.now()}`;
        await saveDropiAccount(accountId, label, tokens, pending.bodega, pending.pais);
        return back(`dropi=ok&cuenta=${encodeURIComponent(label)}${pending.bodega ? `&bodega=${encodeURIComponent(pending.bodega)}` : ''}${pending.pais ? `&pais=${encodeURIComponent(pending.pais)}` : ''}`);
    } catch (e) {
        return back(`dropi=error&msg=${encodeURIComponent(e instanceof Error ? e.message.slice(0, 120) : 'error')}`);
    }
}
