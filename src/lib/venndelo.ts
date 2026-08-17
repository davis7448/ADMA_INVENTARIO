// Integración con la API de Venndelo (solo servidor).
// Auth por refresh_token (durable, en env VENNDELO_REFRESH_TOKEN); el access
// token dura 1h y se pide al vuelo. Si Venndelo rota el refresh_token, se guarda
// el nuevo en Firestore (settings/venndelo_auth) para no perder la conexión.
// El refresh_token se lee y escribe con el ADMIN SDK, no con el SDK de cliente.
// Antes se usaba el de cliente y funcionaba porque la regla de Firestore concedía
// acceso cuando NO había autenticación (`isAdminAccess()` = `request.auth == null`),
// lo que dejaba esta credencial legible por cualquiera desde internet. El admin SDK
// no pasa por las reglas, así que el documento puede quedar cerrado a todo el mundo.
import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import type { ParsedRow } from '@/lib/platform-sales';

async function adminDb() {
    return getFirestore(await getApp());
}

const API = 'https://api.venndelo.com/v1/admin';

// Venndelo → estados internos (mapeamos a los del reporte de Dropi que ya maneja
// el motor). Venta real = DELIVERED. Finales = DELIVERED/RETURNED/CANCELLED.
const STATUS_MAP: Record<string, string> = {
    DELIVERED: 'ENTREGADO',
    RETURNED: 'DEVOLUCION',
    CANCELLED: 'CANCELADO',
    INCIDENT: 'NOVEDAD',
    SHIPPED: 'EN TRANSITO',
    PREPARING: 'PREPARANDO',
    READY: 'LISTO',
    PENDING: 'PENDIENTE',
};

// Firestore no admite '/', '.', '#', '$', '[', ']' ni '..' en un ID de documento.
// Guía e itemId se usan como componentes de doc ID, así que los saneamos en el
// origen para que claves de mapas y doc IDs queden consistentes.
function safeId(s: string): string {
    return String(s || '')
        .replace(/[\/\\.#$\[\]]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'X';
}

async function getRefreshToken(): Promise<string> {
    // Prioriza el rotado guardado en Firestore; si no, el del entorno
    try {
        const snap = await (await adminDb()).collection('settings').doc('venndelo_auth').get();
        if (snap.exists && snap.get('refreshToken')) return snap.get('refreshToken');
    } catch { /* ignora */ }
    const env = process.env.VENNDELO_REFRESH_TOKEN;
    if (!env) throw new Error('VENNDELO_REFRESH_TOKEN no está configurado.');
    return env;
}

export async function getAccessToken(): Promise<string> {
    const refreshToken = await getRefreshToken();
    const res = await fetch(`${API}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!res.ok) {
        throw new Error(`Venndelo OAuth ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    // Si el refresh_token rotó, guardar el nuevo. No debe abortar la sync si la
    // escritura falla (ya tenemos un access token válido para esta corrida).
    if (data.refresh_token && data.refresh_token !== refreshToken) {
        try {
            await (await adminDb()).collection('settings').doc('venndelo_auth')
                .set({ refreshToken: data.refresh_token, updatedAt: Date.now() }, { merge: true });
        } catch (e) {
            console.error('Venndelo: no se pudo persistir el refresh_token rotado:', e);
        }
    }
    return data.access_token;
}

// Trae las órdenes de los últimos `days` días, paginando. Mapea cada línea de
// producto a una fila (como el formato por-producto de Dropi): el motor agrupa
// por guía. El ingreso ADMA = supplier_price (lo que el dropshipper paga a ADMA).
export async function fetchVenndeloOrders(days: number, onProgress?: (msg: string) => void): Promise<ParsedRow[]> {
    const access = await getAccessToken();
    const sinceMs = Date.now() - days * 86400000;

    const rows: ParsedRow[] = [];
    let pageToken = '';
    let page = 0;
    while (true) {
        page++;
        onProgress?.(`Venndelo: página ${page}…`);
        const url = new URL(`${API}/orders`);
        url.searchParams.set('page_size', '100');
        if (pageToken) url.searchParams.set('page_token', pageToken);
        const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${access}` } });
        if (!res.ok) throw new Error(`Venndelo orders ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const data = await res.json();
        const items = data.items || [];

        let allOld = items.length > 0;
        for (const order of items) {
            const created = order.created_at ? new Date(order.created_at).getTime() : null;
            if (created && created >= sinceMs) allOld = false;
            // Se filtra por fecha en memoria (la API pagina por token, sin filtro
            // de fecha simple); solo entran órdenes dentro de la ventana.
            if (created && created < sinceMs) continue;

            // Guía: del envío si existe, si no el id de la orden (saneada para doc ID)
            const shipment = (order.shipments || [])[0];
            const guia = safeId(String(shipment?.tracking_number || order.pin || order.id || ''));
            const estado = STATUS_MAP[order.status] || String(order.status || '').toUpperCase();
            // Fecha: entrega si está, si no creación
            const fecha = shipment?.delivery_date || order.created_at || '';
            const clientEmail = (order.billing_info?.email || order.shipping_info?.email || '').trim().toLowerCase() || undefined;
            const clientName = order.billing_info?.name || order.shipping_info?.name || undefined;

            const lineItems = order.line_items || [];
            // Una fila por línea de producto (el motor agrupa por guía)
            for (const li of lineItems) {
                const sku = li.sku ? String(li.sku) : undefined;
                // sku queda crudo (para cruce con inventario); itemId saneado (es doc ID)
                const itemId = safeId(li.variation_id ? String(li.variation_id) : (sku || String(li.id || '')));
                const qty = Number(li.quantity) || 1;
                rows.push({
                    guia,
                    fecha: typeof fecha === 'string' ? fecha : new Date(fecha).toISOString(),
                    estado,
                    itemIds: itemId ? [itemId] : [],
                    total: (Number(li.supplier_price) || 0) * qty, // ingreso ADMA
                    totalClienteFinal: order.total || undefined,
                    quantity: qty,
                    itemQuantities: itemId ? { [itemId]: qty } : undefined,
                    itemInfo: itemId ? { [itemId]: { sku, productName: li.name || undefined } } : undefined,
                    clientEmail,
                    clientName,
                });
            }
        }

        pageToken = data.next_page_token || '';
        // Fin: sin más páginas, o toda la página ya es más vieja que la ventana
        if (!pageToken || allOld) break;
    }
    return rows;
}
