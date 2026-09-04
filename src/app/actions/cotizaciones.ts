"use server";

// Bandeja interna de cotizaciones de maquila.
//
// Lectura y transiciones pasan por el servidor con el admin SDK: las reglas dejan
// `quoteRequests` en solo lectura para el equipo y sin escritura desde el navegador, así
// que un cambio de estado no puede hacerse a mano desde la consola del navegador.
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
// Estados y transiciones viven en un módulo normal: este fichero es "use server" y
// Next solo deja exportar funciones async desde aquí.
import { ESTADO_LABEL, TRANSICIONES, type EstadoCotizacion } from '@/lib/cotizaciones-estados';
import { getTaskAttachments, uploadAttachmentsToTask, clickupFetch, type ClickUpAttachment } from '@/lib/clickup';
import {
    crearTareaCotizacion, listarObservaciones, agregarObservacion,
    comercialesDisponibles, asignarComercial,
    ESTADO_CLICKUP, type Observacion,
} from '@/lib/clickup-cotizaciones';

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
    clickupTaskId?: string;
    clickupUrl?: string;
    comercialAsignado?: string;
    enlaceReferencia?: string;
    pais?: string;
    // Campos del formulario V5 (2026-09-04).
    marca?: string;
    rolFabricacion?: string;
    estudiosEstabilidad?: string;
    funcionesCosing: string[];
    proclamas: string[];
    proclamaOtra?: string;
    variantesColor?: string;
    envase?: string;
    nso?: string;
    chatwootConversationId?: number;
};

// Una línea con el bloque NSO, para la tabla y el Excel.
function resumenNso(v: FirebaseFirestore.DocumentData): string | undefined {
    if (v.tieneRegistro === undefined) return undefined;
    if (!v.tieneRegistro) return 'No tiene';
    const partes = [v.nsoNumero || '—', v.nsoVigente ? 'vigente' : 'no vigente',
        v.nsoTitularidad === 'otro_laboratorio' ? 'de otro laboratorio' : 'propia'];
    if (v.nsoAdicionar && v.nsoAdicionar !== 'no') partes.push(`adicionar como ${v.nsoAdicionar}`, `trámite: ${v.nsoTramite === 'adma' ? 'ADMA' : 'cliente'}`);
    return partes.join(' · ');
}

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
                clickupTaskId: v.clickupTaskId,
                clickupUrl: v.clickupUrl,
                comercialAsignado: v.comercialAsignado,
                enlaceReferencia: v.enlaceReferencia,
                pais: v.pais,
                marca: v.marca,
                rolFabricacion: v.rolFabricacion,
                estudiosEstabilidad: v.estudiosEstabilidad,
                funcionesCosing: v.funcionesCosing || [],
                proclamas: v.proclamas || [],
                proclamaOtra: v.proclamaOtra,
                variantesColor: v.variantesColor,
                envase: [v.envaseMaterial, v.envaseTipo, v.envaseDetalle].filter(Boolean).join(' / ') || undefined,
                nso: resumenNso(v),
                chatwootConversationId: v.chatwootConversationId,
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
            return { ok: true as const, taskId: snap.get('clickupTaskId') as string | undefined };
        });

        // Espejo hacia ClickUp. Va fuera de la transacción y con su propio catch: el
        // estado en ADMA ya está guardado y una caída de la API no debe deshacerlo.
        if (resultado.ok && resultado.taskId) {
            const statusClickUp = ESTADO_CLICKUP[nuevo];
            if (statusClickUp) {
                try {
                    await clickupFetch(`/task/${resultado.taskId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: statusClickUp }),
                    });
                } catch (e) {
                    console.error('[cotizaciones] estado cambiado en ADMA pero no en ClickUp:', e);
                }
            }
        }

        return resultado.ok ? { success: true } : { success: false, error: resultado.error };
    } catch (error) {
        console.error('[cotizaciones] error cambiando el estado:', error);
        return { success: false, error: 'No se pudo cambiar el estado.' };
    }
}

// --- Destinatarios del aviso de cotización nueva ---
//
// Viven en Firestore, no en el código, para que un admin los cambie desde la aplicación
// sin desplegar. El worker (scripts/procesar-cotizaciones.ts) los lee de aquí.

const DOC_NOTIF = 'cotizadorNotificacion';

export async function obtenerDestinatarios(): Promise<string[]> {
    try {
        const fs = getFirestore(await getApp());
        const snap = await fs.collection('settings').doc(DOC_NOTIF).get();
        return snap.exists ? (snap.get('destinatarios') || []) : [];
    } catch (error) {
        console.error('[cotizaciones] error leyendo destinatarios:', error);
        return [];
    }
}

// El rol se comprueba EN EL SERVIDOR leyendo el documento del usuario: que la interfaz
// solo enseñe el botón a los admin no impide llamar a la acción por otra vía.
async function esAdmin(fs: FirebaseFirestore.Firestore, correoActor: string): Promise<boolean> {
    if (!correoActor) return false;
    const q = await fs.collection('users').where('email', '==', correoActor).limit(1).get();
    return !q.empty && q.docs[0].get('role') === 'admin';
}

export async function guardarDestinatarios(
    correos: string[],
    correoActor: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const fs = getFirestore(await getApp());
        if (!(await esAdmin(fs, correoActor))) {
            return { success: false, error: 'Solo un administrador puede cambiar los destinatarios.' };
        }
        const limpios = Array.from(new Set(
            correos.map(c => c.trim().toLowerCase()).filter(c => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c))
        ));
        await fs.collection('settings').doc(DOC_NOTIF).set({
            destinatarios: limpios,
            actualizadoPor: correoActor,
            actualizadoAt: Timestamp.now(),
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error('[cotizaciones] error guardando destinatarios:', error);
        return { success: false, error: 'No se pudieron guardar los destinatarios.' };
    }
}

// --- Puente con ClickUp -------------------------------------------------------
//
// ClickUp es la fuente de verdad del trabajo: aquí solo se abre la vía para crear la
// tarea espejo y para leer/escribir lo que el equipo va anexando allí. Los adjuntos y
// los comentarios NO se copian a Firestore, se consultan en vivo — el mismo criterio que
// ya rige en el puente de solicitudes, y que además evita meter fórmulas de clientes en
// un bucket de Storage que hoy es de lectura pública.

async function taskIdDe(cotizacionId: string): Promise<string | null> {
    const fs = getFirestore(await getApp());
    const snap = await fs.collection('quoteRequests').doc(cotizacionId).get();
    return snap.exists ? (snap.get('clickupTaskId') || null) : null;
}

export async function sincronizarCotizacionClickUp(
    cotizacionId: string,
): Promise<{ success: boolean; taskId?: string; url?: string; error?: string }> {
    return crearTareaCotizacion(cotizacionId);
}

export async function adjuntosCotizacion(
    cotizacionId: string,
): Promise<{ success: boolean; adjuntos?: ClickUpAttachment[]; error?: string }> {
    try {
        const taskId = await taskIdDe(cotizacionId);
        if (!taskId) return { success: false, error: 'La cotización todavía no está en ClickUp.' };
        return { success: true, adjuntos: await getTaskAttachments(taskId) };
    } catch (error) {
        console.error('[cotizaciones] error leyendo adjuntos:', error);
        return { success: false, error: 'No se pudieron leer los adjuntos.' };
    }
}

// Los archivos viajan del navegador a ClickUp pasando por el servidor, que es quien
// tiene el token. El límite de cuerpo de las server actions ya está subido a 25 MB en
// next.config.js: con el de 1 MB por defecto las fotos de móvil fallaban en silencio.
export async function subirAdjuntosCotizacion(
    cotizacionId: string,
    formData: FormData,
): Promise<{ success: boolean; subidos?: number; error?: string }> {
    try {
        const taskId = await taskIdDe(cotizacionId);
        if (!taskId) return { success: false, error: 'La cotización todavía no está en ClickUp.' };
        const archivos = formData.getAll('archivos').filter((f): f is File => f instanceof File && f.size > 0);
        if (!archivos.length) return { success: true, subidos: 0 };
        const r = await uploadAttachmentsToTask(taskId, archivos);
        return {
            success: r.errors.length === 0,
            subidos: r.uploaded,
            error: r.errors.length ? r.errors.join('; ') : undefined,
        };
    } catch (error) {
        console.error('[cotizaciones] error subiendo adjuntos:', error);
        return { success: false, error: 'No se pudieron subir los archivos.' };
    }
}

export async function observacionesCotizacion(
    cotizacionId: string,
): Promise<{ success: boolean; observaciones?: Observacion[]; error?: string }> {
    try {
        const taskId = await taskIdDe(cotizacionId);
        if (!taskId) return { success: false, error: 'La cotización todavía no está en ClickUp.' };
        return { success: true, observaciones: await listarObservaciones(taskId) };
    } catch (error) {
        console.error('[cotizaciones] error leyendo observaciones:', error);
        return { success: false, error: 'No se pudieron leer las observaciones.' };
    }
}

export async function agregarObservacionCotizacion(
    cotizacionId: string,
    texto: string,
    actor: string,
): Promise<{ success: boolean; error?: string }> {
    const limpio = texto.trim();
    if (!limpio) return { success: false, error: 'La observación está vacía.' };
    if (limpio.length > 4000) return { success: false, error: 'La observación es demasiado larga.' };
    try {
        const taskId = await taskIdDe(cotizacionId);
        if (!taskId) return { success: false, error: 'La cotización todavía no está en ClickUp.' };
        await agregarObservacion(taskId, limpio, actor);
        return { success: true };
    } catch (error) {
        console.error('[cotizaciones] error escribiendo la observación:', error);
        return { success: false, error: 'No se pudo guardar la observación.' };
    }
}

export async function comercialesCotizaciones(): Promise<string[]> {
    try {
        return await comercialesDisponibles();
    } catch (error) {
        console.error('[cotizaciones] error leyendo los comerciales:', error);
        return [];
    }
}

export async function asignarComercialCotizacion(
    cotizacionId: string,
    comercial: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const taskId = await taskIdDe(cotizacionId);
        if (!taskId) return { success: false, error: 'La cotización todavía no está en ClickUp.' };
        await asignarComercial(taskId, comercial);

        const fs = getFirestore(await getApp());
        await fs.collection('quoteRequests').doc(cotizacionId).update({
            comercialAsignado: comercial, updatedAt: Timestamp.now(),
        });
        return { success: true };
    } catch (error) {
        console.error('[cotizaciones] error asignando el comercial:', error);
        return { success: false, error: error instanceof Error ? error.message : 'No se pudo asignar.' };
    }
}
