// Puente con ClickUp (fase 4b). Solo se usa en código de servidor:
// el token vive en la variable de entorno CLICKUP_API_TOKEN.
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import type { EstadoSolicitud, Modificacion } from '@/app/actions/modificaciones';

export const CLICKUP_TEAM_ID = '90131435012';
export const CLICKUP_LIST_ID = '901319185035';
const CLICKUP_API = 'https://api.clickup.com/api/v2';
const N8N_ACTIVACION_URL = 'https://n8n-n8nwork.e72bkl.easypanel.host/webhook/ACTIVACION';

// Estados de la lista de ClickUp → estados de solicitud en ADMA
const CLICKUP_STATUS_MAP: Record<string, EstadoSolicitud> = {
    'pendientes': 'pendiente',
    'en revision': 'en_revision',
    'aprobados': 'aprobado',
    'rechazado': 'rechazado',
    'creados': 'creado',
};

function getToken(): string {
    const token = process.env.CLICKUP_API_TOKEN;
    if (!token) throw new Error('CLICKUP_API_TOKEN no está configurado.');
    return token;
}

async function clickupFetch(path: string, init?: RequestInit): Promise<any> {
    const response = await fetch(`${CLICKUP_API}${path}`, {
        ...init,
        headers: {
            'Authorization': getToken(),
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
        },
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`ClickUp API ${response.status}: ${body.slice(0, 300)}`);
    }
    return response.json();
}

type FieldMap = Record<string, { id: string; type: string; options: Record<string, string> }>;

// Normaliza para empatar opciones de dropdown: mayúsculas, sin tildes,
// espacios colapsados ("José  David" ≡ "JOSE DAVID").
function normalizeLabel(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

// Mapa de custom fields de la lista, indexado por nombre (mayúsculas).
// Se consulta en cada sync (~84/semana, muy por debajo del rate limit) para
// resistir cambios de opciones en ClickUp sin redeploy.
async function getListFieldMap(): Promise<FieldMap> {
    const data = await clickupFetch(`/list/${CLICKUP_LIST_ID}/field`);
    const map: FieldMap = {};
    for (const field of data.fields || []) {
        const options: Record<string, string> = {};
        for (const opt of field.type_config?.options || []) {
            const label = normalizeLabel((opt.name || opt.label || '').toString());
            if (label) options[label] = opt.id;
        }
        map[normalizeLabel(field.name)] = { id: field.id, type: field.type, options };
    }
    return map;
}

function fieldValue(map: FieldMap, name: string, rawValue: unknown): { id: string; value: unknown } | null {
    const field = map[normalizeLabel(name)];
    if (!field || rawValue === undefined || rawValue === null || rawValue === '') return null;
    if (field.type === 'drop_down') {
        const optionId = field.options[normalizeLabel(String(rawValue))];
        return optionId ? { id: field.id, value: optionId } : null;
    }
    return { id: field.id, value: rawValue };
}

export { buildObservacionesText } from '@/lib/solicitud-text';
import { buildObservacionesText } from '@/lib/solicitud-text';

// --- ADMA → ClickUp: crear la tarea espejo de una solicitud ---

export async function createClickUpTaskForSolicitud(modificacionId: string): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const modRef = doc(db, 'modificaciones', modificacionId);
    try {
        const snap = await getDoc(modRef);
        if (!snap.exists()) return { success: false, error: 'La solicitud no existe.' };
        const solicitud = snap.data() as Modificacion;
        if ((solicitud as any).clickupTaskId) {
            return { success: true, taskId: (solicitud as any).clickupTaskId };
        }

        const map = await getListFieldMap();
        const observaciones = buildObservacionesText(solicitud);
        const customFields = [
            fieldValue(map, 'TIPO DE STOCK', solicitud.SOLICITUD),
            fieldValue(map, 'PLATAFORMA', solicitud.PLATAFORMA),
            fieldValue(map, 'BODEGA', solicitud.BODEGA),
            fieldValue(map, 'PAIS', solicitud.PAIS),
            fieldValue(map, 'STOCK', solicitud['CANTIDAD SOLICITADA']),
            fieldValue(map, 'PRECIO', solicitud['PRECIO ']),
            fieldValue(map, 'TIPO DE PRECIO', solicitud.TIPO_PRECIO),
            fieldValue(map, 'CORREO PRIVATIZACION', solicitud.CORREO_CODIGO),
            fieldValue(map, 'ID PLATAFORMA', solicitud.ID !== null && solicitud.ID !== undefined ? String(solicitud.ID) : undefined),
            fieldValue(map, 'COMERCIAL', solicitud.COMERCIAL),
            fieldValue(map, 'ENLACE DRIVE', solicitud.ENLACE_DRIVE),
            fieldValue(map, 'OBSEVRACIONES O VARIANTES', observaciones),
        ].filter((f): f is { id: string; value: unknown } => f !== null);

        const tipoLabel = solicitud.tipoModificacion === 'CREACION_ITEM' ? 'CREACIÓN DE ITEM' : `${solicitud.SOLICITUD || 'AJUSTE'} DE STOCK`;
        const task = await clickupFetch(`/list/${CLICKUP_LIST_ID}/task`, {
            method: 'POST',
            body: JSON.stringify({
                name: solicitud.PRODUCTO || 'Solicitud sin nombre',
                markdown_description: [
                    `**Solicitud desde ADMA Inventario** (${tipoLabel})`,
                    solicitud['SKU '] ? `SKU: ${solicitud['SKU ']}` : null,
                    solicitud.solicitadoPor?.name ? `Solicitado por: ${solicitud.solicitadoPor.name}` : null,
                    `Consecutivo ADMA: ${solicitud['ID CONSECUTIVO'] ?? '—'}`,
                ].filter(Boolean).join('\n'),
                status: 'pendientes',
                custom_fields: customFields,
            }),
        });

        await updateDoc(modRef, { clickupTaskId: task.id, clickupSync: 'synced' });
        return { success: true, taskId: task.id };
    } catch (error) {
        console.error('Error creating ClickUp task:', error);
        await updateDoc(modRef, { clickupSync: 'error' }).catch(() => {});
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// --- ClickUp → ADMA: aplicar el cambio de estado de la tarea ---

export async function applyClickUpStatusToSolicitud(taskId: string, clickupStatus: string): Promise<{ success: boolean; estado?: EstadoSolicitud; error?: string }> {
    const estado = CLICKUP_STATUS_MAP[clickupStatus.trim().toLowerCase()];
    if (!estado) return { success: false, error: `Estado de ClickUp sin mapeo: ${clickupStatus}` };

    const snap = await getDocs(query(collection(db, 'modificaciones'), where('clickupTaskId', '==', taskId), limit(1)));
    if (snap.empty) return { success: false, error: `No hay solicitud vinculada a la tarea ${taskId}` };

    const modDoc = snap.docs[0];
    const solicitud = modDoc.data() as Modificacion;
    if (solicitud.estadoSolicitud === estado) return { success: true, estado };

    const updates: Record<string, any> = { estadoSolicitud: estado };
    if (estado === 'creado') updates.CREADO = 'SI';
    await updateDoc(modDoc.ref, updates);

    // Efectos al marcar creado una creación de item (mismos que updateSolicitudEstado)
    if (estado === 'creado' && solicitud.tipoModificacion === 'CREACION_ITEM' && solicitud.productId) {
        const now = new Date().toISOString();
        await updateDoc(doc(db, 'products', solicitud.productId), {
            activationStatus: 'activo',
            activatedAt: now,
            activationModificacionId: modDoc.id,
        }).catch(err => console.error('No se pudo activar el producto:', err));

        try {
            const poItems = await getDocs(query(
                collection(db, 'purchaseOrderItems'),
                where('productId', '==', solicitud.productId),
                where('status', 'in', ['almacenada', 'liquidada'])
            ));
            await Promise.all(poItems.docs.map(d => updateDoc(d.ref, { status: 'activada', updatedAt: now })));
        } catch (err) {
            console.error('No se pudieron avanzar las líneas de OC:', err);
        }

        try {
            await fetch(N8N_ACTIVACION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'ACTUALIZAR' }),
            });
        } catch (err) {
            console.error('No se pudo disparar el webhook n8n:', err);
        }
    }

    return { success: true, estado };
}

// Consulta el estado actual de una tarea (para el cron de respaldo)
export async function getClickUpTaskStatus(taskId: string): Promise<string | null> {
    try {
        const task = await clickupFetch(`/task/${taskId}`);
        return task.status?.status || null;
    } catch {
        return null;
    }
}
