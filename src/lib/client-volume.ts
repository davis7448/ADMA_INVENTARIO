// Clasificación dinámica del cliente por volumen de compra y seguimiento de
// último contacto. Los umbrales son configurables en Ajustes (settings/crm_config).
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import type { CommercialClient } from '@/types/commercial';

export type ClientTier = 'A' | 'B' | 'C' | 'Nuevo';

export type CrmConfig = {
    tierAThreshold: number; // COP en pedidos para ser cliente A
    tierBThreshold: number; // COP en pedidos para ser cliente B
    warnDays: number; // días sin contacto para alerta ámbar
    alertDays: number; // días sin contacto para alerta roja
};

export const DEFAULT_CRM_CONFIG: CrmConfig = {
    tierAThreshold: 5_000_000,
    tierBThreshold: 1_000_000,
    warnDays: 15,
    alertDays: 30,
};

export const TIER_LABELS: Record<ClientTier, string> = {
    A: 'A · Alto volumen',
    B: 'B · Volumen medio',
    C: 'C · Volumen bajo',
    Nuevo: 'Sin compras',
};

// Cache en memoria: se lee una vez por sesión de página
let cachedConfig: CrmConfig | null = null;

export async function loadCrmConfig(): Promise<CrmConfig> {
    if (cachedConfig) return cachedConfig;
    try {
        const snap = await getDoc(doc(db, 'settings', 'crm_config'));
        cachedConfig = snap.exists()
            ? { ...DEFAULT_CRM_CONFIG, ...snap.data() } as CrmConfig
            : DEFAULT_CRM_CONFIG;
    } catch {
        cachedConfig = DEFAULT_CRM_CONFIG;
    }
    return cachedConfig;
}

export async function updateCrmConfig(config: CrmConfig): Promise<void> {
    await setDoc(doc(db, 'settings', 'crm_config'), {
        ...config,
        updatedAt: Timestamp.now(),
    }, { merge: true });
    cachedConfig = config;
}

export function getClientVolume(client: CommercialClient, config: CrmConfig = DEFAULT_CRM_CONFIG): { total: number; ordersCount: number; tier: ClientTier } {
    const orders = Array.isArray(client.orders) ? client.orders : [];
    const ordersTotal = orders.reduce((acc, o) => acc + (Number(o?.total) || 0), 0);
    const total = ordersTotal > 0 ? ordersTotal : (Number(client.avg_sales) || 0);

    let tier: ClientTier;
    if (total >= config.tierAThreshold) tier = 'A';
    else if (total >= config.tierBThreshold) tier = 'B';
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
