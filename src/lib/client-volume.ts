// Clasificación dinámica del cliente por volumen de compra.
// Volumen = suma de pedidos embebidos (ventas x mayor del CRM); si no hay
// pedidos registrados, cae al avg_sales manual de la ficha.
import type { CommercialClient } from '@/types/commercial';

export type ClientTier = 'A' | 'B' | 'C' | 'Nuevo';

export const TIER_THRESHOLDS = {
    A: 5_000_000, // COP en pedidos registrados
    B: 1_000_000,
};

export const TIER_LABELS: Record<ClientTier, string> = {
    A: 'A · Alto volumen',
    B: 'B · Volumen medio',
    C: 'C · Volumen bajo',
    Nuevo: 'Sin compras',
};

export function getClientVolume(client: CommercialClient): { total: number; ordersCount: number; tier: ClientTier } {
    const orders = Array.isArray(client.orders) ? client.orders : [];
    const ordersTotal = orders.reduce((acc, o) => acc + (Number(o?.total) || 0), 0);
    const total = ordersTotal > 0 ? ordersTotal : (Number(client.avg_sales) || 0);

    let tier: ClientTier;
    if (total >= TIER_THRESHOLDS.A) tier = 'A';
    else if (total >= TIER_THRESHOLDS.B) tier = 'B';
    else if (total > 0) tier = 'C';
    else tier = 'Nuevo';

    return { total, ordersCount: orders.length, tier };
}

// Días desde el último contacto real (oferta, pedido o nota); si nunca se
// registró contacto, usa updated_at/created_at como aproximación.
export function daysSinceLastContact(client: CommercialClient): number | null {
    const raw = client.last_contacted_at ?? client.updated_at ?? client.created_at;
    if (!raw) return null;
    const date = typeof raw?.toDate === 'function' ? raw.toDate() : new Date(raw);
    if (isNaN(date.getTime())) return null;
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}
