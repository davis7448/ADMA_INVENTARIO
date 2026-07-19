// Difusión comercial (fase 5): registro de a qué clientes se les ofertó cada
// producto y por qué canal. Solo REGISTRO — el envío (WhatsApp/IG) se hace por
// fuera. Módulo cliente, mismo patrón que modificaciones.ts.
import { db } from '@/lib/firebase';
import {
    collection, addDoc, getDocs, doc, updateDoc,
    query, where, limit, serverTimestamp,
} from 'firebase/firestore';
import { addClientEvent } from '@/lib/commercial-api';

export type PromotionChannel = 'whatsapp' | 'estado_instagram' | 'directo' | 'grupo' | 'otro';
export type PromotionType = 'nuevo_producto' | 'reabastecimiento' | 'remarketing' | 'cambio_precio';
export type PromotionOutcome = 'sin_respuesta' | 'interesado' | 'pedido' | 'rechazado';

export type ProductPromotion = {
    id?: string;
    productId: string;
    productName: string;
    productSku?: string;
    categoryId?: string;
    clientId: string;
    clientName: string;
    channel: PromotionChannel;
    promotionType: PromotionType;
    outcome?: PromotionOutcome;
    notes?: string;
    date: number; // epoch ms
    commercialId: string;
    commercialName: string;
};

export const PROMOTION_CHANNEL_LABELS: Record<PromotionChannel, string> = {
    whatsapp: 'WhatsApp',
    estado_instagram: 'Estado Instagram',
    directo: 'Directo',
    grupo: 'Grupo',
    otro: 'Otro',
};

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
    nuevo_producto: 'Producto Nuevo',
    reabastecimiento: 'Reabastecimiento',
    remarketing: 'Remarketing',
    cambio_precio: 'Cambio de Precio',
};

export const PROMOTION_OUTCOME_LABELS: Record<PromotionOutcome, string> = {
    sin_respuesta: 'Sin Respuesta',
    interesado: 'Interesado',
    pedido: 'Pedido',
    rechazado: 'Rechazado',
};

const COLLECTION = 'productPromotions';

function stripUndefined<T extends Record<string, any>>(data: T): T {
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    return data;
}

// Registra la difusión de un producto a N clientes (una promoción por cliente)
// y deja el evento en la línea de tiempo de cada cliente del CRM.
export async function createPromotions(input: {
    product: { id: string; name: string; sku?: string; categoryId?: string };
    clients: Array<{ id: string; name: string }>;
    channel: PromotionChannel;
    promotionType: PromotionType;
    notes?: string;
    commercial: { id: string; name: string };
}): Promise<{ created: number }> {
    const now = Date.now();
    let created = 0;

    for (const client of input.clients) {
        await addDoc(collection(db, COLLECTION), stripUndefined({
            productId: input.product.id,
            productName: input.product.name,
            productSku: input.product.sku,
            categoryId: input.product.categoryId,
            clientId: client.id,
            clientName: client.name,
            channel: input.channel,
            promotionType: input.promotionType,
            notes: input.notes?.trim() || undefined,
            date: now,
            commercialId: input.commercial.id,
            commercialName: input.commercial.name,
        }));
        created++;

        // Una oferta = contacto real: actualiza el último contacto del cliente
        try {
            await updateDoc(doc(db, 'clients', client.id), { last_contacted_at: serverTimestamp() });
        } catch (error) {
            console.error('No se pudo actualizar last_contacted_at:', error);
        }

        // Evento en la línea de tiempo del cliente (no bloquea si falla)
        try {
            await addClientEvent(
                client.id,
                'promotion',
                `Oferta: ${input.product.name} (${PROMOTION_CHANNEL_LABELS[input.channel]})`,
                input.commercial.id,
                input.commercial.name,
                `Tipo: ${PROMOTION_TYPE_LABELS[input.promotionType]}${input.notes ? ` — ${input.notes}` : ''}`
            );
        } catch (error) {
            console.error('No se pudo registrar el evento del cliente:', error);
        }
    }

    return { created };
}

export async function getPromotions(options?: { commercialId?: string; clientId?: string; max?: number }): Promise<ProductPromotion[]> {
    const constraints = [];
    if (options?.commercialId) constraints.push(where('commercialId', '==', options.commercialId));
    if (options?.clientId) constraints.push(where('clientId', '==', options.clientId));
    const q = query(collection(db, COLLECTION), ...constraints, limit(options?.max ?? 300));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as ProductPromotion))
        .sort((a, b) => b.date - a.date);
}

export async function updatePromotionOutcome(id: string, outcome: PromotionOutcome): Promise<void> {
    await updateDoc(doc(db, COLLECTION, id), { outcome });
}

// Remarketing asistido: clientes con historial del producto — lo venden o testean
// (arrays del CRM, ahora alimentados por pedidos/testeos) o respondieron bien a
// una oferta anterior (productPromotions con outcome pedido/interesado).
export type ClientHistoryHit = { id: string; name: string; status?: string; source: 'selling' | 'testing' | 'oferta_previa' };

export async function getClientsWithProductHistory(productId: string): Promise<ClientHistoryHit[]> {
    const results: ClientHistoryHit[] = [];
    const seen = new Set<string>();

    for (const field of ['products_selling', 'products_testing'] as const) {
        try {
            const snap = await getDocs(query(
                collection(db, 'clients'),
                where(field, 'array-contains', productId),
                limit(100)
            ));
            for (const d of snap.docs) {
                if (seen.has(d.id)) continue;
                seen.add(d.id);
                const data = d.data();
                results.push({
                    id: d.id,
                    name: data.name || '(sin nombre)',
                    status: data.status,
                    source: field === 'products_selling' ? 'selling' : 'testing',
                });
            }
        } catch (error) {
            console.error(`Error consultando ${field}:`, error);
        }
    }

    // Ofertas previas con respuesta positiva
    try {
        const promoSnap = await getDocs(query(
            collection(db, COLLECTION),
            where('productId', '==', productId),
            limit(200)
        ));
        for (const d of promoSnap.docs) {
            const p = d.data() as ProductPromotion;
            if (seen.has(p.clientId)) continue;
            if (p.outcome === 'pedido' || p.outcome === 'interesado') {
                seen.add(p.clientId);
                results.push({ id: p.clientId, name: p.clientName, source: 'oferta_previa' });
            }
        }
    } catch (error) {
        console.error('Error consultando ofertas previas:', error);
    }

    return results;
}
