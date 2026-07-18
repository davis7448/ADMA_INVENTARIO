"use server";

import { db } from '@/lib/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, limit, runTransaction,
} from 'firebase/firestore';
import { uploadImageAndGetURL } from '@/lib/api';
import { DEFAULT_IMPORT_TARIFF_PER_CBM } from '@/lib/types';
import type { Product, PurchaseOrder, PurchaseOrderItem, PurchaseOrderItemStatus, PurchaseOrderStatus } from '@/lib/types';

const ORDERS_COLLECTION = 'purchaseOrders';
const ITEMS_COLLECTION = 'purchaseOrderItems';

// --- Helpers ---

async function getTariffPerCbm(): Promise<number> {
    try {
        const snap = await getDoc(doc(db, 'settings', 'import_config'));
        return snap.exists() ? (snap.data().tariffPerCbm ?? DEFAULT_IMPORT_TARIFF_PER_CBM) : DEFAULT_IMPORT_TARIFF_PER_CBM;
    } catch {
        return DEFAULT_IMPORT_TARIFF_PER_CBM;
    }
}

function computeEstimatedCost(productCost?: number, cbmPerUnit?: number, tariffPerCbm?: number): number | undefined {
    if (productCost === undefined || productCost === null) return undefined;
    const freight = (cbmPerUnit && tariffPerCbm) ? cbmPerUnit * tariffPerCbm : 0;
    return Math.round(productCost + freight);
}

function stripUndefined<T extends Record<string, any>>(data: T): T {
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    return data;
}

// --- Órdenes de compra ---

export async function createPurchaseOrderAction(data: {
    supplierId?: string;
    groupackRef?: string;
    warehouseId?: string;
    estimatedArrivalDate?: string;
    notes?: string;
    createdBy: { id: string; name: string };
}): Promise<{ success: boolean; id?: string; orderNumber?: string; error?: string }> {
    try {
        const year = new Date().getFullYear();
        const counterRef = doc(db, 'counters', `purchaseOrders_${year}`);

        const orderNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            const nextId = counterDoc.exists() ? counterDoc.data().currentId + 1 : 1;
            if (counterDoc.exists()) {
                transaction.update(counterRef, { currentId: nextId });
            } else {
                transaction.set(counterRef, { currentId: nextId });
            }
            return `OC-${year}-${String(nextId).padStart(3, '0')}`;
        });

        const now = new Date().toISOString();
        const docRef = await addDoc(collection(db, ORDERS_COLLECTION), stripUndefined({
            orderNumber,
            supplierId: data.supplierId,
            groupackRef: data.groupackRef,
            warehouseId: data.warehouseId,
            status: 'documentada' as PurchaseOrderStatus,
            estimatedArrivalDate: data.estimatedArrivalDate,
            notes: data.notes,
            createdBy: data.createdBy,
            createdAt: now,
            updatedAt: now,
        }));

        return { success: true, id: docRef.id, orderNumber };
    } catch (error) {
        console.error('Error creating purchase order:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

export async function getPurchaseOrdersAction(): Promise<PurchaseOrder[]> {
    const q = query(collection(db, ORDERS_COLLECTION), orderBy('createdAt', 'desc'), limit(200));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder));
}

export async function getPurchaseOrderAction(id: string): Promise<{ order: PurchaseOrder | null; items: PurchaseOrderItem[] }> {
    const orderSnap = await getDoc(doc(db, ORDERS_COLLECTION, id));
    if (!orderSnap.exists()) {
        return { order: null, items: [] };
    }
    const itemsQuery = query(collection(db, ITEMS_COLLECTION), where('purchaseOrderId', '==', id));
    const itemsSnap = await getDocs(itemsQuery);
    const items = itemsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as PurchaseOrderItem))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { order: { id: orderSnap.id, ...orderSnap.data() } as PurchaseOrder, items };
}

export async function updatePurchaseOrderAction(id: string, data: Partial<Pick<PurchaseOrder, 'supplierId' | 'groupackRef' | 'warehouseId' | 'estimatedArrivalDate' | 'notes' | 'status'>>): Promise<{ success: boolean; error?: string }> {
    try {
        await updateDoc(doc(db, ORDERS_COLLECTION, id), stripUndefined({ ...data, updatedAt: new Date().toISOString() }));

        // Al pasar la OC a en_transito, avanzar las líneas que siguen en documentada
        if (data.status === 'en_transito') {
            const itemsQuery = query(collection(db, ITEMS_COLLECTION), where('purchaseOrderId', '==', id), where('status', '==', 'documentada'));
            const itemsSnap = await getDocs(itemsQuery);
            await Promise.all(itemsSnap.docs.map(d =>
                updateDoc(d.ref, { status: 'en_transito', updatedAt: new Date().toISOString() })
            ));
        }
        return { success: true };
    } catch (error) {
        console.error('Error updating purchase order:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// --- Líneas de la orden ---

export async function addPurchaseOrderItemAction(formData: FormData): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const purchaseOrderId = formData.get('purchaseOrderId') as string;
        const sku = (formData.get('sku') as string || '').trim();
        const productName = (formData.get('productName') as string || '').trim();
        if (!purchaseOrderId || !sku || !productName) {
            return { success: false, error: 'SKU y nombre de producto son requeridos.' };
        }

        const productId = (formData.get('productId') as string) || undefined;
        const expectedUnits = Number(formData.get('expectedUnits') || 0);
        const expectedBoxes = formData.get('expectedBoxes') ? Number(formData.get('expectedBoxes')) : undefined;
        const unitsPerBox = formData.get('unitsPerBox') ? Number(formData.get('unitsPerBox')) : undefined;
        const cbmPerUnit = formData.get('cbmPerUnit') ? Number(formData.get('cbmPerUnit')) : undefined;
        const productCost = formData.get('productCost') ? Number(formData.get('productCost')) : undefined;
        const contentLink = (formData.get('contentLink') as string || '').trim() || undefined;

        if (!expectedUnits || expectedUnits <= 0) {
            return { success: false, error: 'La cantidad esperada de unidades debe ser mayor a 0.' };
        }

        const inspectionPhotos: string[] = [];
        for (const file of formData.getAll('inspectionPhotos')) {
            if (file instanceof File && file.size > 0) {
                inspectionPhotos.push(await uploadImageAndGetURL(file));
            }
        }

        const orderSnap = await getDoc(doc(db, ORDERS_COLLECTION, purchaseOrderId));
        if (!orderSnap.exists()) {
            return { success: false, error: 'La orden de compra no existe.' };
        }
        const orderStatus = (orderSnap.data() as PurchaseOrder).status;

        const tariff = await getTariffPerCbm();
        const now = new Date().toISOString();
        const docRef = await addDoc(collection(db, ITEMS_COLLECTION), stripUndefined({
            purchaseOrderId,
            sku,
            productName,
            productId: productId || null,
            entryType: productId ? 'reabastecimiento' : 'nuevo',
            expectedUnits,
            expectedBoxes,
            unitsPerBox,
            cbmPerUnit,
            productCost,
            unitCostEstimated: computeEstimatedCost(productCost, cbmPerUnit, tariff),
            inspectionPhotos,
            contentLink,
            contentStatus: 'pendiente',
            status: orderStatus === 'documentada' ? 'documentada' : 'en_transito',
            createdAt: now,
            updatedAt: now,
        }));

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error adding purchase order item:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

export async function updatePurchaseOrderItemAction(itemId: string, data: Partial<Pick<PurchaseOrderItem, 'sku' | 'productName' | 'productId' | 'entryType' | 'expectedUnits' | 'expectedBoxes' | 'unitsPerBox' | 'cbmPerUnit' | 'productCost' | 'contentLink' | 'contentStatus' | 'status'>>): Promise<{ success: boolean; error?: string }> {
    try {
        const itemRef = doc(db, ITEMS_COLLECTION, itemId);
        const updates: Record<string, any> = { ...data, updatedAt: new Date().toISOString() };

        // Recalcular costo estimado si cambió costo o volumen
        if ('productCost' in data || 'cbmPerUnit' in data) {
            const current = await getDoc(itemRef);
            if (current.exists()) {
                const item = current.data() as PurchaseOrderItem;
                const productCost = 'productCost' in data ? data.productCost : item.productCost;
                const cbmPerUnit = 'cbmPerUnit' in data ? data.cbmPerUnit : item.cbmPerUnit;
                const tariff = await getTariffPerCbm();
                const estimated = computeEstimatedCost(productCost, cbmPerUnit, tariff);
                if (estimated !== undefined) updates.unitCostEstimated = estimated;
            }
        }

        await updateDoc(itemRef, stripUndefined(updates));
        return { success: true };
    } catch (error) {
        console.error('Error updating purchase order item:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

export async function addItemInspectionPhotosAction(itemId: string, formData: FormData): Promise<{ success: boolean; photos?: string[]; error?: string }> {
    try {
        const uploaded: string[] = [];
        for (const file of formData.getAll('photos')) {
            if (file instanceof File && file.size > 0) {
                uploaded.push(await uploadImageAndGetURL(file));
            }
        }
        if (uploaded.length === 0) {
            return { success: false, error: 'No se recibieron fotos.' };
        }
        const itemRef = doc(db, ITEMS_COLLECTION, itemId);
        const snap = await getDoc(itemRef);
        if (!snap.exists()) {
            return { success: false, error: 'La línea no existe.' };
        }
        const existing = (snap.data() as PurchaseOrderItem).inspectionPhotos || [];
        await updateDoc(itemRef, { inspectionPhotos: [...existing, ...uploaded], updatedAt: new Date().toISOString() });
        return { success: true, photos: uploaded };
    } catch (error) {
        console.error('Error adding inspection photos:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

export async function deletePurchaseOrderItemAction(itemId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await deleteDoc(doc(db, ITEMS_COLLECTION, itemId));
        return { success: true };
    } catch (error) {
        console.error('Error deleting purchase order item:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// --- Liquidación (fase 3): costo final por línea + actualización del costo del producto ---

export async function liquidatePurchaseOrderAction(
    purchaseOrderId: string,
    rows: Array<{ itemId: string; unitCostFinal: number }>,
    user: import('@/lib/types').User | null
): Promise<{ success: boolean; liquidated?: number; productsUpdated?: number; skippedSkus?: string[]; error?: string }> {
    try {
        if (!user || !['admin', 'coordinacion'].includes(user.role)) {
            return { success: false, error: 'No tienes permiso para liquidar mercancía.' };
        }
        if (rows.length === 0) {
            return { success: false, error: 'No hay líneas con costo final para liquidar.' };
        }

        const now = new Date().toISOString();
        const costRows: Array<{ rowNumber: number; sku: string; cost: number; isLiquidation: boolean }> = [];

        let liquidated = 0;
        for (const row of rows) {
            if (!Number.isFinite(row.unitCostFinal) || row.unitCostFinal <= 0) continue;
            const itemRef = doc(db, ITEMS_COLLECTION, row.itemId);
            const snap = await getDoc(itemRef);
            if (!snap.exists()) continue;
            const item = snap.data() as PurchaseOrderItem;
            if (item.purchaseOrderId !== purchaseOrderId) continue;

            await updateDoc(itemRef, {
                unitCostFinal: row.unitCostFinal,
                status: 'liquidada',
                updatedAt: now,
            });
            liquidated++;

            if (item.productId) {
                costRows.push({ rowNumber: costRows.length + 1, sku: item.sku, cost: row.unitCostFinal, isLiquidation: true });
            }
        }

        // Actualizar el costo de los productos existentes (reusa la resolución de SKU + preview del módulo de costos)
        let productsUpdated = 0;
        let skippedSkus: string[] = [];
        if (costRows.length > 0) {
            const { applyCostPriceUpdateAction } = await import('./products');
            const applyResult = await applyCostPriceUpdateAction(costRows, user);
            productsUpdated = applyResult.applied;
            skippedSkus = applyResult.preview.rows
                .filter(r => r.status !== 'valid')
                .map(r => r.sku);
        }

        await updateDoc(doc(db, ORDERS_COLLECTION, purchaseOrderId), { status: 'liquidada', updatedAt: now });

        return { success: true, liquidated, productsUpdated, skippedSkus };
    } catch (error) {
        console.error('Error liquidating purchase order:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// Busca un producto existente por SKU (padre o variante) para vincular la línea como reabastecimiento
export async function findProductBySkuAction(sku: string): Promise<{ found: boolean; productId?: string; productName?: string; variantId?: string; contentLink?: string; priceDropshipping?: number; activationStatus?: string }> {
    const trimmed = sku.trim();
    if (!trimmed) return { found: false };

    const bySku = query(collection(db, 'products'), where('sku', '==', trimmed), limit(1));
    const snap = await getDocs(bySku);
    if (!snap.empty) {
        const d = snap.docs[0];
        const product = d.data() as Product;
        return {
            found: true, productId: d.id, productName: product.name,
            contentLink: product.contentLink, priceDropshipping: product.priceDropshipping,
            activationStatus: product.activationStatus,
        };
    }

    // Buscar en variantes de productos variables (escaneo acotado)
    const variableQuery = query(collection(db, 'products'), where('productType', '==', 'variable'), limit(500));
    const variableSnap = await getDocs(variableQuery);
    for (const d of variableSnap.docs) {
        const product = d.data() as Product;
        const variant = product.variants?.find(v => v.sku === trimmed);
        if (variant) {
            return {
                found: true, productId: d.id, productName: product.name, variantId: variant.id,
                contentLink: product.contentLink, priceDropshipping: variant.priceDropshipping,
                activationStatus: product.activationStatus,
            };
        }
    }

    return { found: false };
}

// Líneas de OC pendientes por producto (para badge "Por llegar" en inventario)
export async function getIncomingItemsByProductAction(productId: string): Promise<PurchaseOrderItem[]> {
    const q = query(
        collection(db, ITEMS_COLLECTION),
        where('productId', '==', productId),
        where('status', 'in', ['documentada', 'en_transito'])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrderItem));
}
