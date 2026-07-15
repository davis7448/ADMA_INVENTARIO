import { differenceInCalendarMonths, format } from 'date-fns';
import type { CommercialClient } from '@/types/commercial';
import type { Modificacion } from '@/app/actions/modificaciones';

// Formas mínimas de pedidos/testeos tal como los devuelve getAllClientHistory().
// (Los tipos ClientOrder/ClientTest no están definidos en @/types/commercial — deuda preexistente.)
export interface HistoryOrder {
    clientId: string;
    created_at?: unknown;
    items?: { product_name?: string; quantity?: number }[];
}
export interface HistoryTest {
    clientId: string;
    created_at?: unknown;
    product_name?: string;
    productName?: string;
}

export interface DateRange {
    from: Date;
    to: Date;
}

export interface ClientProductRow {
    clientId: string;
    name: string;
    email: string;
    commercialName: string;
    unitsReserved: number;          // suma de CANTIDAD SOLICITADA en el rango
    distinctProductsReserved: number;
    orderUnits: number;             // unidades en pedidos del CRM en el rango
    orderProducts: number;          // productos distintos pedidos en el rango
    testCount: number;              // # de testeos en el rango
    totalUnits: number;             // unitsReserved + orderUnits
    rotationPerMonth: number;       // rotación = unidades reservadas / meses del rango
}

export interface OrphanEmailRow {
    email: string;
    commercialInMod: string | null; // comercial que figura en la modificación (si hay)
    unitsReserved: number;
    reservationsCount: number;
    distinctProducts: number;
}

export interface ClientProductMetrics {
    perClient: ClientProductRow[];    // orden desc por totalUnits
    orphanEmails: OrphanEmailRow[];   // orden desc por unitsReserved
    rangeMonths: number;              // meses que cubre el rango (denominador de la rotación)
    totals: {
        totalUnitsReserved: number;
        totalOrderUnits: number;
        clientsWithProduct: number;
        orphanEmailCount: number;
        orphanUnits: number;
    };
}

const normEmail = (v: unknown): string =>
    typeof v === 'string' ? v.trim().toLowerCase() : '';

const getModEmail = (m: Modificacion): string =>
    normEmail(m.CORREO_CODIGO) || normEmail(m.customerEmail);

const getModQty = (m: Modificacion): number => Number(m['CANTIDAD SOLICITADA']) || 0;

// Normaliza fechas: epoch (número), Date o Timestamp de Firestore → ms, o null.
const toMs = (value: unknown): number | null => {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
        return (value as any).toDate().getTime();
    }
    const parsed = new Date(value as any).getTime();
    return isNaN(parsed) ? null : parsed;
};

const inRange = (ms: number | null, from: number, to: number): boolean =>
    ms != null && ms >= from && ms <= to;

export interface ReservationsDayValue {
    count: number; // número de reservas (documentos) ese día
    units: number; // cantidad reservada (suma de CANTIDAD SOLICITADA) ese día
}

/**
 * Reservas por día (yyyy-MM-dd) dentro del rango, distinguiendo n.º de reservas y cantidad reservada.
 * Se usa para superponer las reservas en el gráfico de altas en el tiempo.
 */
export function computeReservationsByDay(
    modificaciones: Modificacion[],
    range: DateRange,
): Record<string, ReservationsDayValue> {
    const from = range.from.getTime();
    const to = range.to.getTime();
    const byDay: Record<string, ReservationsDayValue> = {};
    for (const mod of modificaciones) {
        const ms = toMs(mod.FECHA);
        if (!inRange(ms, from, to)) continue;
        const day = format(new Date(ms as number), 'yyyy-MM-dd');
        const entry = byDay[day] || (byDay[day] = { count: 0, units: 0 });
        entry.count += 1;
        entry.units += getModQty(mod);
    }
    return byDay;
}

/**
 * Combina el CRM (clientes + pedidos + testeos) con la colección `modificaciones`
 * (reservas de inventario), acotado al rango de fechas indicado, para reportar cuánto
 * producto se asigna/oferta por cliente y su rotación (unidades reservadas / mes).
 * También detecta correos con reservas en el rango que NO tienen ficha en el CRM.
 */
export function computeClientProductMetrics(
    clients: CommercialClient[],
    orders: HistoryOrder[],
    tests: HistoryTest[],
    modificaciones: Modificacion[],
    range: DateRange,
): ClientProductMetrics {
    const from = range.from.getTime();
    const to = range.to.getTime();
    const rangeMonths = Math.max(1, differenceInCalendarMonths(range.to, range.from) + 1);

    // Índices del CRM.
    const rowByClientId = new Map<string, ClientProductRow>();
    const reservedProductsById = new Map<string, Set<string>>();
    const orderProductsById = new Map<string, Set<string>>();
    const emailToClientId = new Map<string, string>();

    for (const client of clients) {
        const id = client.id || '';
        if (!id) continue;
        rowByClientId.set(id, {
            clientId: id,
            name: client.name || '(sin nombre)',
            email: client.email || '',
            commercialName: client.assigned_commercial_name || client.created_by_name || 'Sin asignar',
            unitsReserved: 0,
            distinctProductsReserved: 0,
            orderUnits: 0,
            orderProducts: 0,
            testCount: 0,
            totalUnits: 0,
            rotationPerMonth: 0,
        });
        reservedProductsById.set(id, new Set());
        orderProductsById.set(id, new Set());

        const emails = [client.email, ...(client.additional_emails || [])];
        for (const e of emails) {
            const key = normEmail(e);
            if (key) emailToClientId.set(key, id);
        }
    }

    // Pedidos del CRM dentro del rango.
    for (const order of orders) {
        const row = rowByClientId.get(order.clientId);
        if (!row) continue;
        if (!inRange(toMs(order.created_at), from, to)) continue;
        for (const item of order.items || []) {
            row.orderUnits += Number(item.quantity) || 0;
            if (item.product_name) orderProductsById.get(order.clientId)!.add(item.product_name);
        }
    }

    // Testeos del CRM dentro del rango (producto ofertado en prueba).
    for (const test of tests) {
        const row = rowByClientId.get(test.clientId);
        if (!row) continue;
        if (!inRange(toMs(test.created_at), from, to)) continue;
        row.testCount += 1;
    }

    // Modificaciones (reservas) dentro del rango — atribuir por correo; si no matchea, es huérfano.
    const orphanByEmail = new Map<string, OrphanEmailRow>();
    const orphanProducts = new Map<string, Set<string>>();

    for (const mod of modificaciones) {
        if (!inRange(toMs(mod.FECHA), from, to)) continue;
        const email = getModEmail(mod);
        if (!email) continue;
        const qty = getModQty(mod);
        const product = mod.PRODUCTO || '';

        const clientId = emailToClientId.get(email);
        if (clientId) {
            const row = rowByClientId.get(clientId)!;
            row.unitsReserved += qty;
            if (product) reservedProductsById.get(clientId)!.add(product);
        } else {
            let orphan = orphanByEmail.get(email);
            if (!orphan) {
                orphan = {
                    email,
                    commercialInMod: mod.COMERCIAL || mod['CODIGO COMERCIAL'] || null,
                    unitsReserved: 0,
                    reservationsCount: 0,
                    distinctProducts: 0,
                };
                orphanByEmail.set(email, orphan);
                orphanProducts.set(email, new Set());
            }
            orphan.unitsReserved += qty;
            orphan.reservationsCount += 1;
            if (!orphan.commercialInMod && (mod.COMERCIAL || mod['CODIGO COMERCIAL'])) {
                orphan.commercialInMod = mod.COMERCIAL || mod['CODIGO COMERCIAL'] || null;
            }
            if (product) orphanProducts.get(email)!.add(product);
        }
    }

    // Consolidar filas por cliente.
    const perClient: ClientProductRow[] = [];
    for (const [id, row] of rowByClientId) {
        row.distinctProductsReserved = reservedProductsById.get(id)!.size;
        row.orderProducts = orderProductsById.get(id)!.size;
        row.totalUnits = row.unitsReserved + row.orderUnits;
        row.rotationPerMonth = row.unitsReserved / rangeMonths;
        perClient.push(row);
    }
    perClient.sort((a, b) => b.totalUnits - a.totalUnits);

    // Consolidar huérfanos.
    const orphanEmails: OrphanEmailRow[] = [];
    for (const [email, orphan] of orphanByEmail) {
        orphan.distinctProducts = orphanProducts.get(email)!.size;
        orphanEmails.push(orphan);
    }
    orphanEmails.sort((a, b) => b.unitsReserved - a.unitsReserved);

    return {
        perClient,
        orphanEmails,
        rangeMonths,
        totals: {
            totalUnitsReserved: perClient.reduce((s, r) => s + r.unitsReserved, 0),
            totalOrderUnits: perClient.reduce((s, r) => s + r.orderUnits, 0),
            clientsWithProduct: perClient.filter((r) => r.totalUnits > 0 || r.testCount > 0).length,
            orphanEmailCount: orphanEmails.length,
            orphanUnits: orphanEmails.reduce((s, r) => s + r.unitsReserved, 0),
        },
    };
}
