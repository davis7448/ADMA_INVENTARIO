// Descubre las herramientas del MCP de Dropi usando el refresh_token guardado.
import { listDropiAccounts, refreshAccess, mcpInit, mcpCall, saveDropiAccount } from '@/lib/dropi-mcp';

async function main() {
    const accounts = await listDropiAccounts();
    console.log('Cuentas conectadas:', accounts.map(a => `${a.label} [${a.bodega || '?'}/${a.pais || '?'}]`).join(', ') || '(ninguna)');
    const acc = accounts[0];
    if (!acc?.refreshToken) throw new Error('La primera cuenta no tiene refresh_token.');

    const tokens = await refreshAccess(acc.refreshToken);
    console.log('access_token OK:', !!tokens.access_token, '· scope:', tokens.scope, '· expires_in:', tokens.expires_in);
    if (tokens.refresh_token && tokens.refresh_token !== acc.refreshToken) {
        await saveDropiAccount(acc.id, acc.label, tokens, acc.bodega, acc.pais);
        console.log('(refresh_token rotado y guardado)');
    }

    const init = await mcpInit(tokens.access_token);
    console.log('serverInfo:', JSON.stringify(init.result?.serverInfo));
    const tools = await mcpCall(tokens.access_token, 'tools/list', {}, init.sessionId);
    const list = tools.result?.tools || [];
    console.log(`\n=== ${list.length} HERRAMIENTAS ===`);
    for (const t of list) {
        console.log(`\n### ${t.name}`);
        if (t.description) console.log(t.description);
        console.log('inputSchema:', JSON.stringify(t.inputSchema));
    }
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
