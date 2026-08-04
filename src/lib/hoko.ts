// Integración con HOKO Colombia (solo servidor).
//
// HOKO no publica documentación técnica; el contrato se determinó sondeando la API:
//   POST https://hoko.com.co/api/login   body {email, password}  → devuelve token
//   (respuesta 422 con "The email field is required." / "The password field is required.")
// El resto de endpoints se autentican con el token (Authorization: Bearer …).
//
// Las credenciales van en el secreto HOKO_EMAIL / HOKO_PASSWORD (nunca en el código).
import type { ParsedRow } from '@/lib/platform-sales';

const API = 'https://hoko.com.co/api';

// Estados HOKO → estados internos del motor (se ajustan al ver datos reales).
const STATUS_MAP: Record<string, string> = {
    ENTREGADO: 'ENTREGADO',
    ENTREGADA: 'ENTREGADO',
    DEVOLUCION: 'DEVOLUCION',
    DEVUELTO: 'DEVOLUCION',
    CANCELADO: 'CANCELADO',
    ANULADO: 'CANCELADO',
    RECHAZADO: 'RECHAZADO',
    EN_TRANSITO: 'EN TRANSITO',
    PENDIENTE: 'PENDIENTE',
};

function mapEstado(raw: unknown): string {
    const n = String(raw ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').trim().toUpperCase();
    if (STATUS_MAP[n]) return STATUS_MAP[n];
    if (n.startsWith('ENTREGAD')) return 'ENTREGADO';
    if (n.startsWith('DEVUELT') || n.startsWith('DEVOLUC')) return 'DEVOLUCION';
    if (n.startsWith('ANULAD') || n.startsWith('CANCEL')) return 'CANCELADO';
    if (n.startsWith('RECHAZ')) return 'RECHAZADO';
    return n || 'PENDIENTE';
}

// Firestore no admite '/', '.', '#', '$', '[', ']' en un doc ID.
function safeId(s: unknown): string {
    return String(s ?? '')
        .replace(/[\/\\.#$\[\]]/g, '_').replace(/\s+/g, '_')
        .replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'X';
}

let cachedToken: { token: string; exp: number } | null = null;

// Inicia sesión y devuelve el token. Se cachea 50 min para no re-loguear en cada llamada.
export async function getHokoToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.exp) return cachedToken.token;
    const email = process.env.HOKO_EMAIL;
    const password = process.env.HOKO_PASSWORD;
    if (!email || !password) throw new Error('Faltan HOKO_EMAIL / HOKO_PASSWORD.');

    const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HOKO login ${res.status}: ${text.slice(0, 200)}`);
    const data = JSON.parse(text);
    // El nombre del campo varía según la implementación; se aceptan los habituales.
    const token = data.token || data.access_token || data.data?.token || data.data?.access_token;
    if (!token) throw new Error(`HOKO login sin token: ${text.slice(0, 200)}`);
    cachedToken = { token, exp: Date.now() + 50 * 60 * 1000 };
    return token;
}

// Llamada autenticada genérica (sirve también para descubrir endpoints).
export async function hokoFetch(path: string, init?: RequestInit): Promise<{ status: number; body: string }> {
    const token = await getHokoToken();
    const res = await fetch(`${API}/${path.replace(/^\//, '')}`, {
        ...init,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init?.headers || {}),
        },
    });
    return { status: res.status, body: await res.text() };
}

// Mapea una orden de HOKO a la fila que consume el motor de ventas.
// Los nombres de campo se confirman al ver la primera respuesta real.
export function mapOrden(o: any): ParsedRow {
    const items: any[] = o.items || o.products || o.detalle || [];
    const itemIds: string[] = [];
    const itemQuantities: Record<string, number> = {};
    const itemInfo: Record<string, { sku?: string; productName?: string }> = {};
    let ingreso = 0;
    let unidades = 0;

    for (const it of items) {
        const id = safeId(it.product_id ?? it.id ?? it.sku);
        if (!id) continue;
        const qty = Number(it.quantity ?? it.cantidad ?? 1) || 1;
        // Ingreso ADMA = precio proveedor por unidad × cantidad (como en Dropi/Venndelo)
        const unit = Number(it.supplier_price ?? it.precio_proveedor ?? it.unit_price ?? it.precio ?? 0) || 0;
        if (!itemIds.includes(id)) itemIds.push(id);
        itemQuantities[id] = (itemQuantities[id] || 0) + qty;
        itemInfo[id] = { sku: it.sku ? String(it.sku) : undefined, productName: it.name ?? it.nombre ?? undefined };
        ingreso += unit * qty;
        unidades += qty;
    }

    return {
        guia: safeId(o.tracking_code ?? o.guia ?? o.tracking ?? o.id),
        fecha: String(o.created_at ?? o.fecha ?? ''),
        estado: mapEstado(o.status ?? o.estado),
        itemIds,
        total: ingreso,
        totalClienteFinal: Number(o.total ?? o.total_venta ?? 0) || undefined,
        quantity: unidades,
        itemQuantities,
        itemInfo,
        clientEmail: (o.customer_email ?? o.email ?? '').toString().trim().toLowerCase() || undefined,
        clientName: o.customer_name ?? o.cliente ?? undefined,
    };
}
