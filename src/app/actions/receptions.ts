"use server";

import { db } from '@/lib/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc,
    query, where, orderBy, limit, runTransaction,
} from 'firebase/firestore';
import { addProduct, registerInventoryEntry, uploadImageAndGetURL } from '@/lib/api';
import type {
    Product, PurchaseOrder, PurchaseOrderItem, Reception, ReceptionItem, User,
} from '@/lib/types';

const RECEPTIONS_COLLECTION = 'receptions';
const RECEPTION_ITEMS_COLLECTION = 'receptionItems';
const PO_COLLECTION = 'purchaseOrders';
const PO_ITEMS_COLLECTION = 'purchaseOrderItems';

function stripUndefined<T extends Record<string, any>>(data: T): T {
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    return data;
}

// --- Iniciar recepción: snapshot de las líneas pendientes de la OC ---

export async function startReceptionAction(purchaseOrderId: string, user: { id: string; name: string }, warehouseId?: string): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const orderSnap = await getDoc(doc(db, PO_COLLECTION, purchaseOrderId));
        if (!orderSnap.exists()) {
            return { success: false, error: 'La orden de compra no existe.' };
        }
        const order = orderSnap.data() as PurchaseOrder;

        // Líneas aún no almacenadas (permite recepciones parciales)
        const itemsSnap = await getDocs(query(
            collection(db, PO_ITEMS_COLLECTION),
            where('purchaseOrderId', '==', purchaseOrderId),
            where('status', 'in', ['documentada', 'en_transito'])
        ));
        if (itemsSnap.empty) {
            return { success: false, error: 'La orden no tiene líneas pendientes por recibir.' };
        }

        const year = new Date().getFullYear();
        const counterRef = doc(db, 'counters', `receptions_${year}`);
        const receptionNumber = await runTransaction(db, async (t) => {
            const c = await t.get(counterRef);
            const next = c.exists() ? c.data().currentId + 1 : 1;
            if (c.exists()) t.update(counterRef, { currentId: next }); else t.set(counterRef, { currentId: next });
            return `REC-${year}-${String(next).padStart(3, '0')}`;
        });

        const now = new Date().toISOString();
        const receptionRef = await addDoc(collection(db, RECEPTIONS_COLLECTION), stripUndefined({
            receptionNumber,
            purchaseOrderId,
            purchaseOrderNumber: order.orderNumber,
            warehouseId: warehouseId || order.warehouseId,
            receivedBy: user,
            status: 'en_conteo',
            createdAt: now,
            updatedAt: now,
        }));

        await Promise.all(itemsSnap.docs.map(d => {
            const item = d.data() as PurchaseOrderItem;
            return addDoc(collection(db, RECEPTION_ITEMS_COLLECTION), stripUndefined({
                receptionId: receptionRef.id,
                purchaseOrderItemId: d.id,
                sku: item.sku,
                productName: item.productName,
                productId: item.productId ?? null,
                entryType: item.entryType,
                expectedUnits: item.expectedUnits,
                expectedBoxes: item.expectedBoxes,
                realPhotos: [],
                inventoryLoaded: false,
                createdAt: now,
                updatedAt: now,
            }));
        }));

        return { success: true, id: receptionRef.id };
    } catch (error) {
        console.error('Error starting reception:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// --- Lecturas ---

export async function getReceptionsAction(): Promise<Reception[]> {
    const q = query(collection(db, RECEPTIONS_COLLECTION), orderBy('createdAt', 'desc'), limit(200));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Reception));
}

export async function getReceptionAction(id: string): Promise<{ reception: Reception | null; items: ReceptionItem[] }> {
    const snap = await getDoc(doc(db, RECEPTIONS_COLLECTION, id));
    if (!snap.exists()) return { reception: null, items: [] };
    const itemsSnap = await getDocs(query(collection(db, RECEPTION_ITEMS_COLLECTION), where('receptionId', '==', id)));
    const items = itemsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as ReceptionItem))
        .sort((a, b) => a.sku.localeCompare(b.sku));
    return { reception: { id: snap.id, ...snap.data() } as Reception, items };
}

// OCs con líneas pendientes por recibir
export async function getReceivablePurchaseOrdersAction(): Promise<PurchaseOrder[]> {
    const q = query(collection(db, PO_COLLECTION), where('status', 'in', ['en_transito', 'recibida_parcial']));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as PurchaseOrder))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// --- Conteo ---

export async function countReceptionItemAction(itemId: string, data: {
    countedUnits: number;
    countedBoxes?: number;
    discrepancyNotes?: string;
}): Promise<{ success: boolean; match?: boolean; error?: string }> {
    try {
        const itemRef = doc(db, RECEPTION_ITEMS_COLLECTION, itemId);
        const snap = await getDoc(itemRef);
        if (!snap.exists()) return { success: false, error: 'La línea de recepción no existe.' };
        const item = snap.data() as ReceptionItem;

        const unitsMatch = data.countedUnits === item.expectedUnits;
        const boxesMatch = item.expectedBoxes === undefined || data.countedBoxes === undefined || data.countedBoxes === item.expectedBoxes;
        const match = unitsMatch && boxesMatch;

        if (!match && !data.discrepancyNotes?.trim()) {
            return { success: false, error: 'El conteo no coincide con lo esperado: la nota de discrepancia es obligatoria.' };
        }

        await updateDoc(itemRef, stripUndefined({
            countedUnits: data.countedUnits,
            countedBoxes: data.countedBoxes,
            match,
            discrepancyNotes: match ? undefined : data.discrepancyNotes?.trim(),
            updatedAt: new Date().toISOString(),
        }));
        return { success: true, match };
    } catch (error) {
        console.error('Error counting reception item:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

export async function addItemRealPhotosAction(itemId: string, formData: FormData): Promise<{ success: boolean; photos?: string[]; error?: string }> {
    try {
        const uploaded: string[] = [];
        for (const file of formData.getAll('photos')) {
            if (file instanceof File && file.size > 0) {
                uploaded.push(await uploadImageAndGetURL(file));
            }
        }
        if (uploaded.length === 0) return { success: false, error: 'No se recibieron fotos.' };

        const itemRef = doc(db, RECEPTION_ITEMS_COLLECTION, itemId);
        const snap = await getDoc(itemRef);
        if (!snap.exists()) return { success: false, error: 'La línea no existe.' };
        const existing = (snap.data() as ReceptionItem).realPhotos || [];
        await updateDoc(itemRef, { realPhotos: [...existing, ...uploaded], updatedAt: new Date().toISOString() });
        return { success: true, photos: uploaded };
    } catch (error) {
        console.error('Error adding real photos:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

export async function setReceptionItemLocationAction(itemId: string, locationId: string | null): Promise<{ success: boolean; error?: string }> {
    try {
        await updateDoc(doc(db, RECEPTION_ITEMS_COLLECTION, itemId), {
            locationId: locationId,
            updatedAt: new Date().toISOString(),
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// --- Cierre de conteo y verificación ---

export async function finishCountingAction(receptionId: string): Promise<{ success: boolean; status?: Reception['status']; error?: string }> {
    try {
        const itemsSnap = await getDocs(query(collection(db, RECEPTION_ITEMS_COLLECTION), where('receptionId', '==', receptionId)));
        const items = itemsSnap.docs.map(d => d.data() as ReceptionItem);

        const uncounted = items.filter(i => i.countedUnits === undefined);
        if (uncounted.length > 0) {
            return { success: false, error: `Faltan ${uncounted.length} línea(s) por contar.` };
        }

        const hasDiscrepancy = items.some(i => i.match === false);
        const status: Reception['status'] = hasDiscrepancy ? 'con_discrepancia' : 'verificada';
        await updateDoc(doc(db, RECEPTIONS_COLLECTION, receptionId), { status, updatedAt: new Date().toISOString() });
        return { success: true, status };
    } catch (error) {
        console.error('Error finishing counting:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// Segunda firma de coordinación cuando hubo discrepancias
export async function verifyReceptionAction(receptionId: string, verifier: { id: string; name: string }): Promise<{ success: boolean; error?: string }> {
    try {
        await updateDoc(doc(db, RECEPTIONS_COLLECTION, receptionId), {
            status: 'verificada',
            verifiedBy: verifier,
            updatedAt: new Date().toISOString(),
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// --- Cargue a inventario ---

export async function loadReceptionInventoryAction(receptionId: string, user: User, newProductDefaults: Record<string, { categoryId: string; vendorId: string }>): Promise<{ success: boolean; loaded?: number; error?: string }> {
    try {
        const receptionRef = doc(db, RECEPTIONS_COLLECTION, receptionId);
        const receptionSnap = await getDoc(receptionRef);
        if (!receptionSnap.exists()) return { success: false, error: 'La recepción no existe.' };
        const reception = receptionSnap.data() as Reception;

        if (reception.status !== 'verificada') {
            return { success: false, error: 'La recepción debe estar verificada antes de cargar el inventario.' };
        }

        const itemsSnap = await getDocs(query(collection(db, RECEPTION_ITEMS_COLLECTION), where('receptionId', '==', receptionId)));
        const pending = itemsSnap.docs.filter(d => !(d.data() as ReceptionItem).inventoryLoaded);

        let loaded = 0;
        for (const itemDoc of pending) {
            const item = { id: itemDoc.id, ...itemDoc.data() } as ReceptionItem;
            const quantity = item.countedUnits ?? 0;
            if (quantity <= 0) continue;

            // Datos de la línea de OC (costo, contenido) para el producto nuevo
            const poItemRef = doc(db, PO_ITEMS_COLLECTION, item.purchaseOrderItemId);
            const poItemSnap = await getDoc(poItemRef);
            const poItem = poItemSnap.exists() ? poItemSnap.data() as PurchaseOrderItem : null;

            let productId = item.productId || undefined;

            // Producto nuevo: crear con lo documentado en la OC
            if (!productId) {
                const defaults = newProductDefaults[item.id];
                if (!defaults?.categoryId || !defaults?.vendorId) {
                    return { success: false, error: `La línea ${item.sku} es producto nuevo: falta categoría y proveedor para crearlo.` };
                }
                const imageUrl = item.realPhotos[0] || poItem?.inspectionPhotos?.[0] || 'https://placehold.co/400x400.png';
                const newProduct: Omit<Product, 'id'> = stripUndefined({
                    sku: item.sku,
                    name: item.productName,
                    description: item.productName,
                    imageUrl,
                    imageHint: item.productName.toLowerCase().split(' ').slice(0, 2).join(' '),
                    categoryId: defaults.categoryId,
                    vendorId: defaults.vendorId,
                    priceDropshipping: 0,
                    cost: poItem?.unitCostFinal ?? poItem?.unitCostEstimated,
                    stock: 0,
                    pendingStock: 0,
                    damagedStock: 0,
                    productType: 'simple',
                    warehouseId: reception.warehouseId,
                    locationId: item.locationId,
                    contentLink: poItem?.contentLink,
                    activationStatus: 'borrador',
                    inspectionPhotos: poItem?.inspectionPhotos,
                    realPhotos: item.realPhotos,
                    createdBy: { id: user.id, name: user.name },
                } as Omit<Product, 'id'>);
                productId = await addProduct(newProduct);
            } else {
                // Reabastecimiento: actualizar ubicación y fotos reales del producto existente
                const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
                if (item.locationId) updates.locationId = item.locationId;
                if (item.realPhotos.length > 0) updates.realPhotos = item.realPhotos;
                await updateDoc(doc(db, 'products', productId), updates).catch(() => {});
            }

            // Entrada de inventario con trazabilidad
            await registerInventoryEntry(
                [{ productId, name: item.productName, sku: item.sku, imageUrl: item.realPhotos[0] || '', quantity }],
                user,
                'reception',
                undefined,
                undefined,
                reception.warehouseId,
                { entryType: item.entryType, purchaseOrderId: reception.purchaseOrderId, receptionId }
            );

            await updateDoc(itemDoc.ref, stripUndefined({
                inventoryLoaded: true,
                productId,
                updatedAt: new Date().toISOString(),
            }));

            // Avanzar la línea de OC con lo recibido
            if (poItemSnap.exists()) {
                await updateDoc(poItemRef, stripUndefined({
                    status: 'almacenada',
                    receivedUnits: item.countedUnits,
                    receivedBoxes: item.countedBoxes,
                    productId,
                    updatedAt: new Date().toISOString(),
                }));
            }
            loaded++;
        }

        // Estado final de la recepción y de la OC
        await updateDoc(receptionRef, { status: 'cargada', updatedAt: new Date().toISOString() });

        const allPoItemsSnap = await getDocs(query(collection(db, PO_ITEMS_COLLECTION), where('purchaseOrderId', '==', reception.purchaseOrderId)));
        const allStored = allPoItemsSnap.docs.every(d => ['almacenada', 'liquidada', 'activada'].includes((d.data() as PurchaseOrderItem).status));
        await updateDoc(doc(db, PO_COLLECTION, reception.purchaseOrderId), {
            status: allStored ? 'recibida' : 'recibida_parcial',
            updatedAt: new Date().toISOString(),
        });

        return { success: true, loaded };
    } catch (error) {
        console.error('Error loading reception inventory:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}
