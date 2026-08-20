"use server";

// Bandeja interna de cotizaciones de maquila.
//
// Lectura y transiciones pasan por el servidor con el admin SDK: las reglas dejan
// `quoteRequests` en solo lectura para el equipo y sin escritura desde el navegador, así
// que un cambio de estado no puede hacerse a mano desde la consola del navegador.
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';

export type EstadoCotizacion =
    | 'recibida' | 'triage' | 'esperando_cliente' | 'revision_tecnica'
    | 'cotizada' | 'aceptada' | 'rechazada' | 'cancelada';

export const ESTADO_LABEL: Record<EstadoCotizacion, string> = {
    recibida: 'Recibida',
    triage: 'En clasificación',
    esperando_cliente: 'Esperando al cliente',
    revision_tecnica: 'Revisión técnica',
    cotizada: 'Cotizada',
    aceptada: 'Aceptada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada',
};

// Qué transiciones son válidas. Sin esto, un estado puede saltar a cualquier otro y el
// historial deja de contar una historia coherente.
export const TRANSICIONES: Record<EstadoCotizacion, EstadoCotizacion[]> = {
    recibida: ['triage', 'cancelada'],
    triage: ['esperando_cliente', 'revision_tecnica', 'cotizada', 'cancelada'],
    esperando_cliente: ['triage', 'cancelada'],
    revision_tecnica: ['cotizada', 'esperando_cliente', 'cancelada'],
    cotizada: ['aceptada', 'rechazada', 'esperando_cliente'],
    aceptada: [],
    rechazada: [],
    cancelada: [],
};

export type CotizacionListada = {
    id: string;
    referencia: string;
    estado: EstadoCotizacion;
    creada: string;            // ISO, para no pasar Timestamps al cliente
    categoria: string;
    formas: string[];
    modalidad: string;
    rutaFormulacion: string;
    presentacion: string;
    cantidad: number;
    marcaBlanca: boolean;
    rutaRegulatoria?: string;
    nombre: string;
    empresa?: string;
    email: string;
    telefono?: string;
    ciudad: string;
    mensaje?: string;
    ingredientesIncluir: string[];
    ingredientesEvitar: string[];
};

export async function listarCotizaciones(): Promise<CotizacionListada[]> {
    try {
        const fs = getFirestore(await getApp());
        const snap = await fs.collection('quoteRequests').orderBy('createdAt', 'desc').limit(500).get();
        return snap.docs.map(d => {
            const v = d.data();
            return {
                id: d.id,
                referencia: v.referencia,
                estado: v.estado,
                creada: (v.createdAt as Timestamp)?.toDate?.().toISOString() || '',
                categoria: v.categoria,
                formas: v.formas || [],
                modalidad: v.modalidad,
                rutaFormulacion: v.rutaFormulacion,
                presentacion: v.presentacion,
                cantidad: v.cantidad,
                marcaBlanca: !!v.marcaBlanca,
                rutaRegulatoria: v.rutaRegulatoria,
                nombre: v.nombre,
                empresa: v.empresa,
                email: v.email,
                telefono: v.telefono,
                ciudad: v.ciudad,
                mensaje: v.mensaje,
                ingredientesIncluir: v.ingredientesIncluir || [],
                ingredientesEvitar: v.ingredientesEvitar || [],
            } as CotizacionListada;
        });
    } catch (error) {
        console.error('[cotizaciones] error listando:', error);
        return [];
    }
}

export type EventoHistorial = { estadoAnterior: string | null; estadoNuevo: string; actor: string; motivo: string; fecha: string };

export async function historialCotizacion(id: string): Promise<EventoHistorial[]> {
    try {
        const fs = getFirestore(await getApp());
        const snap = await fs.collection('quoteRequests').doc(id).collection('history').orderBy('fecha', 'asc').get();
        return snap.docs.map(d => {
            const v = d.data();
            return {
                estadoAnterior: v.estadoAnterior ?? null,
                estadoNuevo: v.estadoNuevo,
                actor: v.actor || '—',
                motivo: v.motivo || '',
                fecha: (v.fecha as Timestamp)?.toDate?.().toISOString() || '',
            };
        });
    } catch (error) {
        console.error('[cotizaciones] error leyendo el historial:', error);
        return [];
    }
}

export async function cambiarEstadoCotizacion(
    id: string,
    nuevo: EstadoCotizacion,
    actor: string,
    motivo: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const fs = getFirestore(await getApp());
        const ref = fs.collection('quoteRequests').doc(id);

        // La validación va dentro de la transacción: dos personas moviendo la misma
        // cotización a la vez no deben poder dejarla en un estado imposible.
        const resultado = await fs.runTransaction(async (t) => {
            const snap = await t.get(ref);
            if (!snap.exists) return { ok: false as const, error: 'La cotización ya no existe.' };
            const actualRaw = snap.get('estado') as EstadoCotizacion;
            const permitidas = TRANSICIONES[actualRaw] || [];
            if (!permitidas.includes(nuevo)) {
                return { ok: false as const, error: `No se puede pasar de "${ESTADO_LABEL[actualRaw]}" a "${ESTADO_LABEL[nuevo]}".` };
            }
            t.update(ref, { estado: nuevo, updatedAt: Timestamp.now() });
            t.set(ref.collection('history').doc(), {
                estadoAnterior: actualRaw, estadoNuevo: nuevo,
                actor, motivo: motivo || 'Sin motivo', fecha: Timestamp.now(),
            });
            return { ok: true as const };
        });

        return resultado.ok ? { success: true } : { success: false, error: resultado.error };
    } catch (error) {
        console.error('[cotizaciones] error cambiando el estado:', error);
        return { success: false, error: 'No se pudo cambiar el estado.' };
    }
}
