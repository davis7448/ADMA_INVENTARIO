// Cliente del MCP de Dropi (solo servidor). OAuth 2.0 authorization_code + PKCE +
// refresh_token (cliente público). Soporta VARIAS cuentas Dropi: cada una guarda su
// propio refresh_token en Firestore (colección dropiAccounts).
// Los refresh_token de Dropi se guardan con el ADMIN SDK, no con el de cliente.
// Con el SDK de cliente esto solo funcionaba porque la regla concedía acceso cuando NO
// había autenticación (`isAdminAccess()` = `request.auth == null`), lo que dejaba las
// credenciales legibles desde internet. El admin SDK no pasa por las reglas.
import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';

async function adminDb() {
    return getFirestore(await getApp());
}
import crypto from 'crypto';
import type { ParsedRow } from '@/lib/platform-sales';

export const DROPI_CLIENT_ID = 'adma-inventario-a51a3a3c';
const AUTHORIZE_URL = 'https://oauth.dropi.co/oauth/authorize';
const TOKEN_URL = 'https://integrations.dropi.co/bff/oauth/token';
const MCP_URL = 'https://mcp.dropi.co/mcp';
const RESOURCE = 'https://mcp.dropi.co/mcp'; // RFC 8707: el token debe emitirse para este resource
const SCOPE = 'mcp';

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// En App Hosting/Cloud Run, request.nextUrl.origin da el host interno (0.0.0.0:8080).
// La URL pública viene en los headers x-forwarded-*.
// Orígenes que Dropi tiene registrados como URL de retorno para nuestro client_id.
// Si el usuario entra por otro dominio (p. ej. el propio inv.admacompany.com), Dropi
// responde `invalid_redirect_uri`: solo acepta los que se registraron al dar de alta el
// cliente. Por eso el flujo OAuth se fuerza al canónico aunque se inicie desde otro sitio.
export const ORIGENES_REGISTRADOS = [
    'https://main--studio-9748962172-82b35.us-east4.hosted.app',
    'https://test--studio-9748962172-82b35.us-east4.hosted.app',
];
export const ORIGEN_CANONICO = ORIGENES_REGISTRADOS[0];

export function origenRegistrado(origen: string): string {
    return ORIGENES_REGISTRADOS.includes(origen) ? origen : ORIGEN_CANONICO;
}

export function publicOrigin(headers: Headers, fallback: string): string {
    const host = headers.get('x-forwarded-host') || headers.get('host');
    if (!host) return fallback;
    const proto = headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${host.split(',')[0].trim()}`;
}

export function genPkce() {
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    return { verifier, challenge };
}

export function buildAuthUrl(redirectUri: string, state: string, challenge: string): string {
    const p = new URLSearchParams({
        response_type: 'code', client_id: DROPI_CLIENT_ID, redirect_uri: redirectUri,
        scope: SCOPE, state, code_challenge: challenge, code_challenge_method: 'S256',
        resource: RESOURCE,
    });
    return `${AUTHORIZE_URL}?${p.toString()}`;
}

async function tokenRequest(body: Record<string, string>): Promise<any> {
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Dropi token ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

export function exchangeCode(code: string, redirectUri: string, verifier: string) {
    return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: DROPI_CLIENT_ID, code_verifier: verifier, resource: RESOURCE });
}

// Renueva el token Y GUARDA el nuevo. Usar SIEMPRE esto en vez de refreshAccess() suelto:
// los refresh_token de Dropi son de un solo uso, así que renovar sin persistir el nuevo
// deja la cuenta con un token muerto. Pasó de verdad: un chequeo de "salud" que solo
// llamaba a refreshAccess() dejó fuera de servicio tres cuentas que estaban sanas.
export async function refrescarYGuardar(cuenta: { id: string; label: string; refreshToken?: string; bodega?: string; pais?: string }) {
    if (!cuenta.refreshToken) throw new Error(`Cuenta ${cuenta.label} sin refresh_token`);
    const tokens = await refreshAccess(cuenta.refreshToken);
    if (tokens.refresh_token && tokens.refresh_token !== cuenta.refreshToken) {
        await saveDropiAccount(cuenta.id, cuenta.label, tokens, cuenta.bodega, cuenta.pais);
    }
    return tokens;
}

export function refreshAccess(refreshToken: string) {
    return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: DROPI_CLIENT_ID, resource: RESOURCE });
}

// --- Persistencia de cuentas y estado OAuth ---
export async function savePendingOauth(state: string, verifier: string, redirectUri: string, label?: string, bodega?: string, pais?: string) {
    await (await adminDb()).collection('dropiOauthPending').doc(state)
        .set({ verifier, redirectUri, label: label || '', bodega: bodega || '', pais: pais || '', createdAt: Date.now() });
}
export async function takePendingOauth(state: string): Promise<{ verifier: string; redirectUri: string; label?: string; bodega?: string; pais?: string } | null> {
    const fs = await adminDb();
    const snap = await fs.collection('dropiOauthPending').doc(state).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    await fs.collection('dropiOauthPending').doc(state).delete().catch(() => {});
    return { verifier: data.verifier, redirectUri: data.redirectUri, label: data.label, bodega: data.bodega, pais: data.pais };
}

export async function saveDropiAccount(accountId: string, label: string, tokens: any, bodega?: string, pais?: string) {
    const payload: Record<string, any> = {
        label, refreshToken: tokens.refresh_token, scope: tokens.scope || SCOPE, updatedAt: Date.now(),
    };
    if (bodega) payload.bodega = bodega; // bodega a la que pertenece la cuenta (INGENIO/LABORATORIO)
    if (pais) payload.pais = pais;       // país de la cuenta (COLOMBIA/MEXICO/...)
    await (await adminDb()).collection('dropiAccounts').doc(accountId).set(payload, { merge: true });
}
export async function listDropiAccounts(): Promise<Array<{ id: string; label: string; refreshToken?: string; bodega?: string; pais?: string; updatedAt?: number }>> {
    const snap = await (await adminDb()).collection('dropiAccounts').get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}

// --- Cliente MCP (Streamable HTTP, respuestas SSE o JSON) ---
function parseMcp(text: string): any {
    const t = text.trim();
    if (t.startsWith('{')) return JSON.parse(t);
    // SSE: buscar la última línea data:
    const dataLines = t.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim());
    for (let i = dataLines.length - 1; i >= 0; i--) {
        try { return JSON.parse(dataLines[i]); } catch { /* sigue */ }
    }
    throw new Error('Respuesta MCP no parseable: ' + t.slice(0, 200));
}

export async function mcpCall(accessToken: string, method: string, params: any, sessionId?: string): Promise<{ result?: any; sessionId?: string }> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${accessToken}`,
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;
    const res = await fetch(MCP_URL, {
        method: 'POST', headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    });
    const sid = res.headers.get('mcp-session-id') || sessionId || undefined;
    const text = await res.text();
    if (!res.ok) throw new Error(`MCP ${method} ${res.status}: ${text.slice(0, 300)}`);
    if (!text.trim()) return { result: undefined, sessionId: sid }; // p.ej. notifications
    const json = parseMcp(text);
    if (json?.error) throw new Error(`MCP ${method}: ${JSON.stringify(json.error).slice(0, 300)}`);
    return { result: json?.result, sessionId: sid };
}

// --- Parsing del formato compacto del MCP (YAML-lite + CSV en items) ---
function textOf(r: { result?: any }): string {
    const c = r.result;
    if (c?.content) for (const p of c.content) if (p.type === 'text') return p.text;
    return typeof c === 'string' ? c : JSON.stringify(c || '');
}
function splitCsv(line: string): string[] {
    const out: string[] = []; let cur = ''; let q = false;
    for (const ch of line) {
        if (ch === '"') { q = !q; continue; }
        if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
        cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
}
// list_orders → lista YAML de órdenes (nivel orden)
export function parseListOrders(text: string): Record<string, string>[] {
    // Dropi devuelve DOS formatos y hay que entender los dos: el antiguo tipo YAML
    // (`- order_id: "..."` y pares clave:valor debajo) y el nuevo CSV con cabecera
    // (`items[100]{order_id,status,...}:` y una fila por orden). El cambio se activó de
    // forma progresiva —una cuenta seguía con el viejo mientras otra ya recibía el
    // nuevo—, y como el parser solo reconocía el antiguo, la cuenta migrada devolvía
    // "0 órdenes" durante diez días sin que nada fallara visiblemente.
    const csv = parseFormatoCsv(text);
    if (csv.length) return csv;
    return parseFormatoYaml(text);
}

// items[N]{col1,col2,...}:  seguido de filas CSV indentadas
function parseFormatoCsv(text: string): Record<string, string>[] {
    const cab = text.match(/^\s*items\[\d+\]\{([^}]+)\}\s*:\s*$/m);
    if (!cab) return [];
    const columnas = cab[1].split(',').map(c => c.trim());
    const filas: Record<string, string>[] = [];
    const lineas = text.split('\n');
    const desde = lineas.findIndex(l => /^\s*items\[\d+\]\{/.test(l)) + 1;
    for (let i = desde; i < lineas.length; i++) {
        const linea = lineas[i];
        if (!linea.trim()) continue;
        if (/^\s*items\[\d+\]\{/.test(linea)) break;   // empieza otro bloque
        const valores = partirCsv(linea.trim());
        if (valores.length < 2) continue;
        const o: Record<string, string> = {};
        columnas.forEach((c, j) => { o[c] = (valores[j] ?? '').trim(); });
        if (o.order_id) filas.push(o);
    }
    return filas;
}

// CSV con comillas: "86892858",PENDIENTE,"Nombre, con coma",...
function partirCsv(linea: string): string[] {
    const out: string[] = [];
    let actual = ''; let enComillas = false;
    for (let i = 0; i < linea.length; i++) {
        const ch = linea[i];
        if (ch === '"') { enComillas = !enComillas; continue; }
        if (ch === ',' && !enComillas) { out.push(actual); actual = ''; continue; }
        actual += ch;
    }
    out.push(actual);
    return out;
}

function parseFormatoYaml(text: string): Record<string, string>[] {
    const orders: Record<string, string>[] = [];
    let cur: Record<string, string> | null = null;
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        const m = line.match(/^\s*-\s+order_id:\s*"?([^"]+?)"?\s*$/);
        if (m) { cur = { order_id: m[1] }; orders.push(cur); continue; }
        if (!cur) continue;
        const kv = line.match(/^\s+([a-z_]+):\s*"?(.*?)"?\s*$/);
        if (kv) cur[kv[1]] = kv[2];
    }
    return orders;
}

// get_order → items (bloque `items[N]{cols}:` con filas CSV). product_name puede traer comas.
function parseGetOrderItems(text: string): Array<{ product_id: string; product_name: string; qty: number; unit_price: number }> {
    const items: Array<{ product_id: string; product_name: string; qty: number; unit_price: number }> = [];
    let inItems = false;
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (/^\s*items\[\d+\]\{[^}]*\}:/.test(line)) { inItems = true; continue; }
        if (!inItems) continue;
        const t = line.trim();
        if (!t) continue;
        if (/^[a-z_]+:/.test(t)) { inItems = false; continue; } // siguiente clave top-level
        const v = splitCsv(t);
        if (v.length < 4) continue;
        // cols: product_id, product_name, qty, unit_price, subtotal → parsear desde la derecha
        items.push({
            product_id: v[0],
            product_name: v.slice(1, v.length - 3).join(','),
            qty: Number(v[v.length - 3]) || 1,
            unit_price: Number(v[v.length - 2]) || 0,
        });
    }
    return items;
}
function safeId(s: string): string {
    return String(s || '').replace(/[\/\\.#$\[\]]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'X';
}
// Estado Dropi → estado interno (venta = ENTREGADO; finales = ENTREGADO/DEVOLUCION/CANCELADO/RECHAZADO)
function mapDropiEstado(s: string): string {
    const n = String(s || '').toUpperCase();
    if (n.includes('ENTREGAD')) return 'ENTREGADO';
    if (n.includes('DEVOL') || n.includes('DEVUELT')) return 'DEVOLUCION';
    if (n.includes('RECHAZ')) return 'RECHAZADO';
    if (n.includes('CANCEL') || n.includes('ANULAD')) return 'CANCELADO';
    return n || 'GENERADA';
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const DAY_MS = 86400000;
const RATE_RE = /rate limit|too many requests|\b429\b/i;
const SERVER_ERR_RE = /respondió\s*5\d\d|status_code:\s*5\d\d/i;   // 5xx: transitorio → reintentar
const CLIENT_ERR_RE = /respondió\s*4\d\d|status_code:\s*4\d\d/i;   // 4xx: cliente → lanzar (excepto 429)
// Llama una tool del MCP con reintentos ante rate limit (429) y errores 5xx (transitorios,
// p.ej. 504 timeout). Los 4xx (rango inválido, etc.) se lanzan; nunca se tragan como vacío.
async function mcpToolText(access: string, name: string, args: any, sid: string | undefined, onProgress?: (m: string) => void): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
        const t = textOf(await mcpCall(access, 'tools/call', { name, arguments: args }, sid));
        if (RATE_RE.test(t) || SERVER_ERR_RE.test(t)) {
            const wait = Math.min(2000 * 2 ** attempt, 30000);
            onProgress?.(`Dropi: ${RATE_RE.test(t) ? 'rate limit' : 'error servidor'}, esperando ${Math.round(wait / 1000)}s…`);
            await sleep(wait);
            continue;
        }
        if (CLIENT_ERR_RE.test(t)) throw new Error(`Dropi MCP ${name}: ${t.replace(/\s+/g, ' ').slice(0, 180)}`);
        return t;
    }
    throw new Error(`Dropi MCP: reintentos agotados en ${name}`);
}

// Trae las órdenes de una cuenta Dropi (últimos `days` días) vía MCP y las mapea a
// ParsedRow (una por orden). Ingreso ADMA = Σ(unit_price × qty). itemId = product_id.
// El MCP tiene rate limit → se llama con throttle + backoff.
export async function fetchDropiOrders(
    account: { id: string; label: string; refreshToken?: string; bodega?: string; pais?: string },
    days: number,
    opts?: { skipGuias?: Set<string>; soloEstados?: boolean },
    onProgress?: (msg: string) => void,
): Promise<ParsedRow[]> {
    if (!account.refreshToken) throw new Error(`Cuenta ${account.label} sin refresh_token`);
    const tokens = await refreshAccess(account.refreshToken);
    if (tokens.refresh_token && tokens.refresh_token !== account.refreshToken) {
        await saveDropiAccount(account.id, account.label, tokens, account.bodega, account.pais);
    }
    const access = tokens.access_token;
    const init = await mcpInit(access);
    const sid = init.sessionId;

    // 1) Paginar list_orders (nivel orden). Dropi limita el rango a <=90 días Y da 504
    //    en paginación profunda → chunks chicos (20 días) para mantener pocas páginas.
    const CHUNK_DAYS = 20;
    const summaries: Record<string, string>[] = [];
    const seen = new Set<string>();
    let end = Date.now() + DAY_MS;
    let remaining = days;
    while (remaining > 0) {
        const chunkDays = Math.min(CHUNK_DAYS, remaining);
        const from = new Date(end - chunkDays * DAY_MS).toISOString().slice(0, 10);
        const until = new Date(end).toISOString().slice(0, 10);
        let start = 0; const pageSize = 100;
        while (true) {
            const t = await mcpToolText(access, 'list_orders', { from, until, result_number: pageSize, start }, sid, onProgress);
            const page = parseListOrders(t);
            // Si Dropi devuelve texto pero el parser no reconoce ninguna orden, es que
            // cambió el formato de respuesta: hay que verlo, no seguir como si no hubiera
            // ventas. Antes esto se traducía en un silencioso "0 órdenes" que ocultó nueve
            // días de sincronización rota.
            if (page.length === 0 && t.trim().length > 40 && start === 0) {
                console.error(`[dropi] ${'list_orders'} devolvió texto que el parser no entiende (${from}..${until}). Muestra:\n${t.slice(0, 600)}`);
            }
            for (const o of page) { const id = String(o.order_id); if (id && !seen.has(id)) { seen.add(id); summaries.push(o); } }
            onProgress?.(`Dropi ${account.label}: ${summaries.length} órdenes…`);
            if (page.length < pageSize) break;
            start += pageSize;
            await sleep(300);
            if (start > 20000) break; // salvaguarda
        }
        end -= chunkDays * DAY_MS;
        remaining -= chunkDays;
    }

    // 2) get_order (caro, rate-limited) SOLO para las ENTREGADAS: son las que
    //    necesitan items para el ingreso ADMA y la atribución por cupo. Las demás se
    //    guardan a nivel orden (estado) para seguimiento. Las entregadas ya importadas
    //    (skipGuias) no se vuelven a consultar → el cron diario solo trae entregas nuevas.
    const skip = opts?.skipGuias;
    const rows: ParsedRow[] = [];
    let entregadas = 0; let nuevasEntregadas = 0;
    for (const o of summaries) {
        const guia = safeId(o.tracking_code || o.order_id);
        const estado = mapDropiEstado(o.status);
        const totalCF = Number(o.total) || undefined;

        // soloEstados: no se consulta get_order (1 petición por orden). Se devuelve
        // el nivel orden para actualizar estados en cuentas de alto volumen.
        if (opts?.soloEstados) {
            rows.push({ guia, fecha: o.created_at || '', estado, itemIds: [], total: 0, totalClienteFinal: totalCF });
            continue;
        }
        if (estado !== 'ENTREGADO') {
            rows.push({ guia, fecha: o.created_at || '', estado, itemIds: [], total: 0, totalClienteFinal: totalCF });
            continue;
        }
        entregadas++;
        if (skip?.has(guia)) continue; // ya importada como entregada con items

        nuevasEntregadas++;
        if (nuevasEntregadas % 20 === 0) onProgress?.(`Dropi ${account.label}: items entregadas ${nuevasEntregadas}…`);
        const it = await mcpToolText(access, 'get_order', { id: String(o.order_id) }, sid, onProgress);
        await sleep(300); // throttle base
        const items = parseGetOrderItems(it);
        const itemIds: string[] = []; const itemQuantities: Record<string, number> = {};
        const itemInfo: Record<string, { sku?: string; productName?: string }> = {};
        let ingresoAdma = 0; let unidades = 0;
        for (const item of items) {
            const pid = safeId(item.product_id);
            if (!pid) continue;
            if (!itemIds.includes(pid)) itemIds.push(pid);
            itemQuantities[pid] = (itemQuantities[pid] || 0) + item.qty;
            itemInfo[pid] = { productName: item.product_name || undefined };
            ingresoAdma += item.unit_price * item.qty;
            unidades += item.qty;
        }
        rows.push({
            guia, fecha: o.created_at || '', estado, itemIds,
            total: ingresoAdma, // ingreso ADMA = Σ(unit_price × qty)
            totalClienteFinal: totalCF, quantity: unidades, itemQuantities, itemInfo,
        });
    }
    onProgress?.(`Dropi ${account.label}: ${summaries.length} órdenes · ${entregadas} entregadas · ${nuevasEntregadas} con items nuevos`);
    return rows;
}

// Inicializa sesión MCP y devuelve el sessionId + capacidades
export async function mcpInit(accessToken: string): Promise<{ sessionId?: string; result?: any }> {
    const r = await mcpCall(accessToken, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'adma-inventario', version: '1.0' },
    });
    // Notificar initialized (algunos servidores lo requieren antes de tools/list)
    try { await mcpCall(accessToken, 'notifications/initialized', {}, r.sessionId); } catch { /* opcional */ }
    return r;
}
