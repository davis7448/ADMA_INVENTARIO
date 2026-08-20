"use server";

// Alta de cotizaciones de maquila.
//
// Se persiste con el ADMIN SDK, no con el de cliente: quien cotiza es un usuario externo
// y no debe tener permisos de escritura sobre la colección. El servidor valida de nuevo
// todo el payload —la validación del navegador es comodidad, no seguridad— y asigna el
// consecutivo dentro de una transacción, siguiendo el patrón de purchase-orders.ts.
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import { CotizacionSchema, type CotizacionInput } from '@/lib/cotizador-schema';

export type ResultadoCotizacion =
    | { success: true; id: string; referencia: string }
    | { success: false; error: string; campos?: Record<string, string> };

export async function crearCotizacion(
    datos: CotizacionInput,
    idempotencyKey: string,
): Promise<ResultadoCotizacion> {
    const parsed = CotizacionSchema.safeParse(datos);
    if (!parsed.success) {
        const campos: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const campo = issue.path.join('.') || 'general';
            if (!campos[campo]) campos[campo] = issue.message;
        }
        return { success: false, error: 'Revisa los datos del formulario.', campos };
    }
    const d = parsed.data;

    try {
        const fs = getFirestore(await getApp());

        // Idempotencia: un doble clic o un reintento tras un timeout no deben crear dos
        // cotizaciones. La clave la genera el navegador una sola vez por envío.
        if (idempotencyKey) {
            const previa = await fs.collection('quoteIdempotency').doc(idempotencyKey).get();
            if (previa.exists) {
                const v = previa.data()!;
                return { success: true, id: v.quoteId, referencia: v.referencia };
            }
        }

        const anio = new Date().getFullYear();
        const counterRef = fs.collection('counters').doc(`quotes_${anio}`);

        // El consecutivo se asigna en transacción: la referencia aleatoria de la
        // referencia externa no garantizaba unicidad.
        const referencia = await fs.runTransaction(async (t) => {
            const snap = await t.get(counterRef);
            const siguiente = (snap.exists ? snap.data()!.currentId : 0) + 1;
            t.set(counterRef, { currentId: siguiente }, { merge: true });
            return `COT-${anio}-${String(siguiente).padStart(4, '0')}`;
        });

        const ref = fs.collection('quoteRequests').doc();
        await ref.set({
            ...d,
            referencia,
            estado: 'recibida',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });

        // Historial append-only desde el primer día: quién y cuándo, sin sobrescribir.
        await ref.collection('history').add({
            estadoAnterior: null, estadoNuevo: 'recibida',
            actor: d.email, motivo: 'Cotización recibida', fecha: Timestamp.now(),
        });

        if (idempotencyKey) {
            await fs.collection('quoteIdempotency').doc(idempotencyKey)
                .set({ quoteId: ref.id, referencia, createdAt: Timestamp.now() });
        }

        return { success: true, id: ref.id, referencia };
    } catch (error) {
        console.error('[cotizador] error creando la cotización:', error);
        return { success: false, error: 'No se pudo registrar la cotización. Inténtalo de nuevo.' };
    }
}
