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
import {
    guardarReferencias, MAX_ARCHIVOS, MAX_BYTES, TIPOS_OK,
} from '@/lib/cotizacion-referencias';
import { registrarCotizacionEnChatwoot } from '@/lib/chatwoot-cotizaciones';

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

        // Aviso al equipo. Va a una cola, no se envía aquí: si el correo falla, la
        // cotización ya está guardada y no debe perderse el aviso. Un worker la reintenta.
        // Escribir en la cola tampoco puede tumbar el alta.
        try {
            await fs.collection('quoteOutbox').add({
                quoteId: ref.id, referencia, tipo: 'nueva_cotizacion',
                resumen: {
                    categoria: d.categoria, formas: d.formas, presentacion: d.presentacion,
                    cantidad: d.cantidad, nombre: d.nombre, empresa: d.empresa || '',
                    email: d.email, telefono: d.telefono || '', ciudad: d.ciudad,
                },
                estado: 'pendiente', intentos: 0, createdAt: Timestamp.now(),
            });
        } catch (e) {
            console.error('[cotizador] la cotización se guardó pero no se pudo encolar el aviso:', e);
        }

        if (idempotencyKey) {
            await fs.collection('quoteIdempotency').doc(idempotencyKey)
                .set({ quoteId: ref.id, referencia, createdAt: Timestamp.now() });
        }

        // WhatsApp del laboratorio: nota privada en la conversación del cliente en
        // Chatwoot, para que comercial la vea donde atiende. Un fallo aquí no tumba el
        // alta: la cotización ya está guardada y avisada por correo.
        try {
            const cw = await registrarCotizacionEnChatwoot(ref.id, d, referencia);
            if (cw.omitida) console.warn(`[cotizador] ${referencia} sin Chatwoot: ${cw.omitida}`);
        } catch (e) {
            console.error('[cotizador] la cotización se guardó pero no se pudo registrar en Chatwoot:', e);
        }

        return { success: true, id: ref.id, referencia };
    } catch (error) {
        console.error('[cotizador] error creando la cotización:', error);
        return { success: false, error: 'No se pudo registrar la cotización. Inténtalo de nuevo.' };
    }
}

// Imágenes de referencia del formulario público.
//
// Se llama justo después de crear la cotización, con el id que devolvió `crearCotizacion`.
// La ruta es pública y sin sesión, así que valida a conciencia: que la cotización exista,
// que sea reciente y que todavía no haya viajado a ClickUp. Sin eso, cualquiera podría
// colgar ficheros de cualquier cotización con solo adivinar un id.
export async function subirReferenciasCotizacion(
    cotizacionId: string,
    formData: FormData,
): Promise<{ success: boolean; guardadas?: number; error?: string }> {
    try {
        const archivos = formData.getAll('referencias').filter((f): f is File => f instanceof File && f.size > 0);
        if (!archivos.length) return { success: true, guardadas: 0 };
        if (archivos.length > MAX_ARCHIVOS) return { success: false, error: `Máximo ${MAX_ARCHIVOS} archivos.` };
        for (const a of archivos) {
            if (a.size > MAX_BYTES) return { success: false, error: `"${a.name}" pasa de 8 MB.` };
            if (!TIPOS_OK.includes(a.type)) return { success: false, error: `"${a.name}" no es una imagen ni un PDF.` };
        }

        const fs = getFirestore(await getApp());
        const ref = fs.collection('quoteRequests').doc(cotizacionId);
        const snap = await ref.get();
        if (!snap.exists) return { success: false, error: 'La cotización no existe.' };
        if (snap.get('clickupTaskId')) return { success: false, error: 'La cotización ya está en ClickUp.' };
        if (snap.get('referencias')?.length) return { success: false, error: 'Ya tiene imágenes de referencia.' };

        // Ventana corta: esto es el remate del envío, no una vía abierta indefinidamente.
        const creada = (snap.get('createdAt') as Timestamp | undefined)?.toMillis() ?? 0;
        if (Date.now() - creada > 2 * 60 * 60 * 1000) {
            return { success: false, error: 'La cotización ya no admite archivos.' };
        }

        const guardadas = await guardarReferencias(cotizacionId, archivos);
        await ref.update({ referencias: guardadas, updatedAt: Timestamp.now() });
        return { success: true, guardadas: guardadas.length };
    } catch (error) {
        console.error('[cotizador] error guardando las referencias:', error);
        return { success: false, error: 'No se pudieron guardar los archivos.' };
    }
}
