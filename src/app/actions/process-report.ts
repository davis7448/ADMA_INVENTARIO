// Fase 6: datos crudos para el reporte de KPIs del proceso completo
// (OC → recepción → liquidación → activación → difusión → clientes).
// Solo lecturas; las agregaciones se calculan en el componente.
import { db } from '@/lib/firebase';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import type { PurchaseOrder, PurchaseOrderItem, Reception, ReceptionItem } from '@/lib/types';
import type { Modificacion } from '@/app/actions/modificaciones';
import type { ProductPromotion } from '@/app/actions/promotions';
import type { CommercialClient } from '@/types/commercial';

export type EntryMovementLite = {
    id: string;
    entryType: 'nuevo' | 'reabastecimiento';
    quantity: number;
    productId: string;
    productName: string;
    date: Date | null;
    purchaseOrderId?: string;
};

export type ProcessReportData = {
    orders: PurchaseOrder[];
    orderItems: PurchaseOrderItem[];
    receptions: Reception[];
    receptionItems: ReceptionItem[];
    solicitudes: (Modificacion & { id: string })[];
    promotions: ProductPromotion[];
    entryMovements: EntryMovementLite[];
    clients: CommercialClient[];
};

async function fetchAll<T>(collectionName: string, max = 2000, mapper?: (id: string, data: any) => T): Promise<T[]> {
    const snapshot = await getDocs(query(collection(db, collectionName), limit(max)));
    return snapshot.docs.map(d => mapper ? mapper(d.id, d.data()) : ({ id: d.id, ...d.data() } as T));
}

export async function getProcessReportData(): Promise<ProcessReportData> {
    const [orders, orderItems, receptions, receptionItems, solicitudesSnap, promotions, movementsSnap, clients] = await Promise.all([
        fetchAll<PurchaseOrder>('purchaseOrders', 500),
        fetchAll<PurchaseOrderItem>('purchaseOrderItems', 2000),
        fetchAll<Reception>('receptions', 500),
        fetchAll<ReceptionItem>('receptionItems', 2000),
        // Solicitudes del flujo nuevo: tienen estadoSolicitud
        getDocs(query(
            collection(db, 'modificaciones'),
            where('estadoSolicitud', 'in', ['pendiente', 'en_revision', 'aprobado', 'rechazado', 'creado']),
            limit(1000)
        )),
        fetchAll<ProductPromotion>('productPromotions', 2000),
        // Solo los movimientos del flujo nuevo llevan entryType
        getDocs(query(
            collection(db, 'inventoryMovements'),
            where('entryType', 'in', ['nuevo', 'reabastecimiento']),
            limit(2000)
        )),
        fetchAll<CommercialClient>('clients', 2000),
    ]);

    const solicitudes = solicitudesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Modificacion & { id: string }));
    const entryMovements: EntryMovementLite[] = movementsSnap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            entryType: data.entryType,
            quantity: Number(data.quantity) || 0,
            productId: data.productId,
            productName: data.productName || '',
            date: typeof data.date?.toDate === 'function' ? data.date.toDate() : (data.date ? new Date(data.date) : null),
            purchaseOrderId: data.purchaseOrderId,
        };
    });

    return { orders, orderItems, receptions, receptionItems, solicitudes, promotions, entryMovements, clients };
}
