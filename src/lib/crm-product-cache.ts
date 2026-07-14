import { getAllClientHistory } from '@/lib/commercial-api';
import { getAllModificacionesForExport, type Modificacion } from '@/app/actions/modificaciones';
import type { CommercialClient } from '@/types/commercial';
import type { HistoryOrder, HistoryTest } from '@/lib/crm-product-metrics';

// Ventana amplia para traer todas las modificaciones (getAllModificacionesForExport usa 6 meses por defecto).
const WIDE_START = new Date(2000, 0, 1);

export interface ClientProductData {
    clients: CommercialClient[];
    orders: HistoryOrder[];
    tests: HistoryTest[];
    modificaciones: Modificacion[];
}

// Caché en memoria a nivel de módulo: se llena en la primera carga y se reutiliza mientras
// no se recargue la página. Guardamos los datos CRUDOS para poder recalcular las métricas
// ante cualquier cambio de rango de fechas sin volver a consultar Firestore.
let cache: ClientProductData | null = null;
let inflight: Promise<ClientProductData> | null = null;

/**
 * Trae de Firestore (una sola vez) los datos crudos de producto por cliente: historial del CRM
 * (clientes + pedidos + testeos) y todas las modificaciones. Dedup de peticiones concurrentes
 * vía `inflight`. Pasar `force` para refrescar.
 */
export async function loadClientProductData(force = false): Promise<ClientProductData> {
    if (!force) {
        if (cache) return cache;
        if (inflight) return inflight;
    }

    inflight = (async () => {
        const [history, modificaciones] = await Promise.all([
            getAllClientHistory(),
            getAllModificacionesForExport(WIDE_START, new Date()),
        ]);
        const data: ClientProductData = {
            clients: history.clients,
            orders: history.allOrders as unknown as HistoryOrder[],
            tests: history.allTests as unknown as HistoryTest[],
            modificaciones: modificaciones as Modificacion[],
        };
        cache = data;
        return data;
    })();

    try {
        return await inflight;
    } finally {
        inflight = null;
    }
}

/** Limpia la caché para forzar una nueva carga (ej. tras crear una modificación). */
export function invalidateClientProductData(): void {
    cache = null;
    inflight = null;
}
