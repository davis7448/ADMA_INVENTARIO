// Cliente del MCP de Dropi (solo servidor). OAuth 2.0 authorization_code + PKCE +
// refresh_token (cliente público). Soporta VARIAS cuentas Dropi: cada una guarda su
// propio refresh_token en Firestore (colección dropiAccounts).
import { db } from '@/lib/firebase';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import crypto from 'crypto';

export const DROPI_CLIENT_ID = 'adma-inventario-a51a3a3c';
const AUTHORIZE_URL = 'https://oauth.dropi.co/oauth/authorize';
const TOKEN_URL = 'https://integrations.dropi.co/bff/oauth/token';
const MCP_URL = 'https://mcp.dropi.co/mcp';
const SCOPE = 'mcp';

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function genPkce() {
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    return { verifier, challenge };
}

export function buildAuthUrl(redirectUri: string, state: string, challenge: string): string {
    const p = new URLSearchParams({
        response_type: 'code', client_id: DROPI_CLIENT_ID, redirect_uri: redirectUri,
        scope: SCOPE, state, code_challenge: challenge, code_challenge_method: 'S256',
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
    return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: DROPI_CLIENT_ID, code_verifier: verifier });
}

export function refreshAccess(refreshToken: string) {
    return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: DROPI_CLIENT_ID });
}

// --- Persistencia de cuentas y estado OAuth ---
export async function savePendingOauth(state: string, verifier: string, redirectUri: string, label?: string) {
    await setDoc(doc(db, 'dropiOauthPending', state), { verifier, redirectUri, label: label || '', createdAt: Date.now() });
}
export async function takePendingOauth(state: string): Promise<{ verifier: string; redirectUri: string; label?: string } | null> {
    const snap = await getDoc(doc(db, 'dropiOauthPending', state));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    await deleteDoc(doc(db, 'dropiOauthPending', state)).catch(() => {});
    return { verifier: data.verifier, redirectUri: data.redirectUri, label: data.label };
}

export async function saveDropiAccount(accountId: string, label: string, tokens: any) {
    await setDoc(doc(db, 'dropiAccounts', accountId), {
        label, refreshToken: tokens.refresh_token, scope: tokens.scope || SCOPE,
        updatedAt: Date.now(),
    }, { merge: true });
}
export async function listDropiAccounts(): Promise<Array<{ id: string; label: string; refreshToken?: string; updatedAt?: number }>> {
    const snap = await getDocs(collection(db, 'dropiAccounts'));
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
