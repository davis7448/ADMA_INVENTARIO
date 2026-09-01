// Puente entre las cotizaciones de maquila y la lista "Cotizaciones" de ClickUp.
//
// ClickUp es la fuente de verdad: el equipo ya trabaja ahí (52 tareas al montar esto) y
// los comerciales no tienen permiso de edición, así que escribe el servidor de ADMA con
// su propio token, igual que en el puente de solicitudes.
//
// La tarea PADRE es el producto cotizado y lleva los custom fields. Las SUBTAREAS —las
// etapas por las que avanza— las crea SOLA una automatización de la lista al aparecer una
// tarea nueva; verificado creando una tarea vacía y viendo salir las cinco. Por eso aquí
// NO se crean: hacerlo dejaba diez subtareas duplicadas.
//
// Firestore se toca con el ADMIN SDK, no con el de cliente: las reglas dejan
// `quoteRequests` sin escritura desde el navegador (firestore.rules).
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import { clickupFetch, getListFieldMap, fieldValue } from '@/lib/clickup';
import type { EstadoCotizacion } from '@/lib/cotizaciones-estados';

export const LISTA_COTIZACIONES = '901314590474';

// Las cinco etapas que la automatización de ClickUp añade a cada tarea. Se listan aquí
// solo para poder nombrarlas en la interfaz; ADMA no las crea.
export const ETAPAS = [
    'COTIZAR ENVASE',
    'FORMULACION',
    'DISEÑO DE ETIQUETA',
    'COTIZACION DE ETIQUETA',
    'COSTO DE FABRICACION',
] as const;

// El dropdown CATEGORIA de ClickUp no cubre `suplemento` (sus opciones son COSMETICO,
// ALIMENTO, INDUSTRIAL, VETERINARIA, VEHICULOS) y escribe VETERINARIA donde la app dice
// `veterinario`. Sin este mapa explícito el emparejado por contención no acierta ninguna
// de las dos. Lo que no tiene equivalente se queda sin campo y viaja en la descripción.
const CATEGORIA_CLICKUP: Record<string, string | null> = {
    cosmetico: 'COSMETICO',
    alimento: 'ALIMENTO',
    industrial: 'INDUSTRIAL',
    veterinario: 'VETERINARIA',
    suplemento: null,
};

// ClickUp → ADMA. Manda ClickUp, así que el webhook aplica el estado aunque la máquina
// de transiciones de la app no permitiera ese salto a mano; queda registrado en el
// historial con el actor "ClickUp" para que se vea de dónde vino.
export const CLICKUP_ESTADO: Record<string, EstadoCotizacion> = {
    'pendiente': 'recibida',
    'en progreso': 'revision_tecnica',
    'en revision': 'cotizada',
    'aprobado': 'aceptada',
    'rechazado': 'rechazada',
    'complete': 'aceptada',
};

// ADMA → ClickUp, para empujar el estado cuando alguien lo mueve desde la bandeja.
export const ESTADO_CLICKUP: Partial<Record<EstadoCotizacion, string>> = {
    recibida: 'pendiente',
    triage: 'pendiente',
    revision_tecnica: 'en progreso',
    esperando_cliente: 'en progreso',
    cotizada: 'en revision',
    aceptada: 'aprobado',
    rechazada: 'rechazado',
};

const SI_NO = (v: unknown) => (v ? 'Sí' : 'No');

// Todo lo que el formulario captura y ClickUp no tiene como campo. Sin esto, la tarea
// llegaría sin la parte técnica —formulación, ingredientes, ruta regulatoria—, que es
// justo lo que necesita quien cotiza.
export function descripcionCotizacion(q: any, referencia: string): string {
    const lineas = [
        `**Cotización de maquila ${referencia}** · capturada en ADMA Inventario`,
        '',
        `**Producto:** ${q.categoria} · ${(q.formas || []).join(', ')}`,
        q.formaOtroDetalle ? `Detalle de "Otro": ${q.formaOtroDetalle}` : null,
        q.esAerosol ? `Aerosol: sí${q.aerosolDetalle ? ` — ${q.aerosolDetalle}` : ''}` : null,
        `**Presentación:** ${q.presentacion} · **Cantidad:** ${Number(q.cantidad || 0).toLocaleString('es-CO')} unidades`,
        '',
        `**Modalidad:** ${q.modalidad === 'full_service' ? 'Full Service' : 'Mixta'}`,
        (q.incluidos || []).length ? `Incluye: ${q.incluidos.join(', ')}` : null,
        (q.aportaCliente || []).length ? `Aporta el cliente: ${q.aportaCliente.join(', ')}` : null,
        '',
        `**Ruta de formulación:** ${q.rutaFormulacion}`,
        q.ideaFormulacion ? `Idea: ${q.ideaFormulacion}` : null,
        q.solicitaMejora ? 'Pide mejora de la fórmula: sí' : null,
        (q.ingredientesIncluir || []).length ? `Ingredientes a incluir: ${q.ingredientesIncluir.join(', ')}` : null,
        (q.ingredientesEvitar || []).length ? `Ingredientes a evitar: ${q.ingredientesEvitar.join(', ')}` : null,
        q.fragancia ? `Fragancia: ${q.fragancia}${q.fraganciaDetalle ? ` — ${q.fraganciaDetalle}` : ''}` : null,
        '',
        `**Marca blanca:** ${SI_NO(q.marcaBlanca)}`,
        q.rutaRegulatoria ? `Ruta regulatoria: ${q.rutaRegulatoria}` : null,
        q.tablaNutricional !== undefined ? `Tabla nutricional: ${SI_NO(q.tablaNutricional)}` : null,
        (q.canalesVenta || []).length ? `Canales de venta: ${q.canalesVenta.join(', ')}` : null,
        '',
        `**Contacto:** ${q.nombre}${q.empresa ? ` · ${q.empresa}` : ''}`,
        `${q.email}${q.telefono ? ` · ${q.telefono}` : ''} · ${q.ciudad}`,
        q.origenLead ? `Origen del lead: ${q.origenLead}` : null,
        q.mensaje ? `\n**Mensaje del cliente:**\n${q.mensaje}` : null,
        q.confidencialidad ? '\n_El cliente pidió confidencialidad._' : null,
    ];
    return lineas.filter(l => l !== null).join('\n');
}

export type ResultadoSync = { success: boolean; taskId?: string; url?: string; error?: string };

// Crea la tarea espejo y sus cinco etapas. Idempotente: si la cotización ya tiene tarea,
// devuelve la existente en vez de duplicarla.
export async function crearTareaCotizacion(cotizacionId: string): Promise<ResultadoSync> {
    const fs = getFirestore(await getApp());
    const ref = fs.collection('quoteRequests').doc(cotizacionId);
    try {
        const snap = await ref.get();
        if (!snap.exists) return { success: false, error: 'La cotización no existe.' };
        const q = snap.data()!;
        if (q.clickupTaskId) return { success: true, taskId: q.clickupTaskId, url: q.clickupUrl };

        const map = await getListFieldMap(LISTA_COTIZACIONES);
        const categoria = CATEGORIA_CLICKUP[q.categoria];
        const customFields = [
            fieldValue(map, 'CLIENTE', q.empresa || q.nombre),
            categoria ? fieldValue(map, 'CATEGORIA', categoria) : null,
            fieldValue(map, 'PRESENTACION', q.presentacion),
            fieldValue(map, 'OBSERVACIONES', q.mensaje),
        ].filter((f): f is { id: string; value: unknown } => f !== null);

        // PAIS y COMERCIAL se dejan vacíos a propósito: el formulario público pide ciudad,
        // no país, y un lead entrante todavía no tiene comercial asignado. Adivinarlos
        // ensucia el tablero — los pone quien clasifica.
        const nombreTarea = `${q.presentacion || 'Producto'} · ${q.empresa || q.nombre}`.slice(0, 120);
        const tarea = await clickupFetch(`/list/${LISTA_COTIZACIONES}/task`, {
            method: 'POST',
            body: JSON.stringify({
                name: nombreTarea,
                markdown_description: descripcionCotizacion(q, q.referencia),
                status: 'pendiente',
                custom_fields: customFields,
            }),
        });

        // Las etapas NO se crean aquí: la automatización de la lista las añade sola en
        // cuanto aparece la tarea.
        await ref.update({
            clickupTaskId: tarea.id,
            clickupUrl: tarea.url || null,
            clickupSync: 'synced',
            updatedAt: Timestamp.now(),
        });
        await ref.collection('history').add({
            // Sin estado anterior: no es un cambio de estado, es una anotación. Así el
            // historial no muestra un "Recibida → Recibida" que no significa nada.
            estadoAnterior: null, estadoNuevo: q.estado,
            actor: 'ADMA', motivo: 'Sincronizada con ClickUp',
            fecha: Timestamp.now(),
        });

        return { success: true, taskId: tarea.id, url: tarea.url };
    } catch (error) {
        console.error('[cotizaciones/clickup] error creando la tarea:', error);
        await ref.update({ clickupSync: 'error' }).catch(() => { });
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// ClickUp → ADMA: el webhook mueve el estado de la cotización vinculada.
export async function aplicarEstadoClickUp(taskId: string, statusClickUp: string): Promise<{ success: boolean; estado?: EstadoCotizacion; error?: string }> {
    const estado = CLICKUP_ESTADO[statusClickUp.trim().toLowerCase()];
    if (!estado) return { success: false, error: `Estado de ClickUp sin mapeo: ${statusClickUp}` };

    const fs = getFirestore(await getApp());
    const snap = await fs.collection('quoteRequests').where('clickupTaskId', '==', taskId).limit(1).get();
    if (snap.empty) return { success: false, error: `No hay cotización vinculada a la tarea ${taskId}` };

    const doc = snap.docs[0];
    const anterior = doc.get('estado') as EstadoCotizacion;
    if (anterior === estado) return { success: true, estado };

    await doc.ref.update({ estado, updatedAt: Timestamp.now() });
    await doc.ref.collection('history').add({
        estadoAnterior: anterior, estadoNuevo: estado,
        actor: 'ClickUp', motivo: `La tarea pasó a "${statusClickUp}"`, fecha: Timestamp.now(),
    });
    return { success: true, estado };
}

// --- Observaciones de la negociación: son comentarios de la tarea ---

export type Observacion = { id: string; texto: string; autor: string; fecha: string };

export async function listarObservaciones(taskId: string): Promise<Observacion[]> {
    const data = await clickupFetch(`/task/${taskId}/comment`);
    return (data.comments || []).map((c: any) => ({
        id: String(c.id),
        texto: c.comment_text || '',
        autor: c.user?.username || c.user?.email || '—',
        // ClickUp devuelve epoch en milisegundos como string.
        fecha: new Date(Number(c.date) || 0).toISOString(),
    })).reverse();  // la API las da de la más nueva a la más vieja
}

export async function agregarObservacion(taskId: string, texto: string, actor: string): Promise<void> {
    await clickupFetch(`/task/${taskId}/comment`, {
        method: 'POST',
        // El autor va en el texto: el token es el de ADMA, así que ClickUp atribuiría
        // todos los comentarios a la misma cuenta y se perdería quién negoció.
        body: JSON.stringify({ comment_text: `[${actor}] ${texto}`, notify_all: false }),
    });
}
