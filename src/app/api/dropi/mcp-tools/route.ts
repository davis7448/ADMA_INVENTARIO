import { NextRequest, NextResponse } from 'next/server';
import { listDropiAccounts, refreshAccess, mcpInit, mcpCall, saveDropiAccount } from '@/lib/dropi-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// DESCUBRIMIENTO (Fase A): lista las herramientas del MCP de Dropi con la primera
// cuenta conectada. Protegido con CRON_SECRET. ?account=<id> para elegir cuenta.
export async function GET(request: NextRequest) {
    const secret = request.nextUrl.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    }
    try {
        const accounts = await listDropiAccounts();
        if (accounts.length === 0) return NextResponse.json({ error: 'No hay cuentas Dropi conectadas todavía.' }, { status: 400 });
        const wanted = request.nextUrl.searchParams.get('account');
        const acc = (wanted && accounts.find(a => a.id === wanted)) || accounts[0];
        if (!acc.refreshToken) return NextResponse.json({ error: 'La cuenta no tiene refresh_token.' }, { status: 400 });

        const tokens = await refreshAccess(acc.refreshToken);
        if (tokens.refresh_token && tokens.refresh_token !== acc.refreshToken) {
            await saveDropiAccount(acc.id, acc.label, tokens);
        }
        const init = await mcpInit(tokens.access_token);
        const tools = await mcpCall(tokens.access_token, 'tools/list', {}, init.sessionId);
        return NextResponse.json({
            account: acc.label,
            cuentasConectadas: accounts.map(a => a.label),
            serverInfo: init.result?.serverInfo,
            capabilities: init.result?.capabilities,
            tools: tools.result?.tools ?? tools.result,
        });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 });
    }
}
