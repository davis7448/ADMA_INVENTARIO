"use server";

import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createClickUpTaskForSolicitud, getTaskAttachments, uploadAttachmentsToTask, type ClickUpAttachment } from '@/lib/clickup';

// La solicitud ya existe en ADMA; esto crea su tarea espejo en ClickUp.
export async function syncSolicitudToClickUpAction(modificacionId: string): Promise<{ success: boolean; taskId?: string; error?: string }> {
    return createClickUpTaskForSolicitud(modificacionId);
}

// Evidencia de creación: adjuntos de la tarea de ClickUp leídos en vivo
// (las imágenes viven solo en ClickUp, no se copian a ADMA).
export async function getSolicitudEvidenceAction(modificacionId: string): Promise<{ success: boolean; attachments?: ClickUpAttachment[]; error?: string }> {
    try {
        const snap = await getDoc(doc(db, 'modificaciones', modificacionId));
        if (!snap.exists()) return { success: false, error: 'La solicitud no existe.' };
        const taskId = snap.data().clickupTaskId;
        if (!taskId) return { success: false, error: 'La solicitud no está vinculada a ClickUp.' };
        const attachments = await getTaskAttachments(taskId);
        return { success: true, attachments };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}

// Sube las imágenes de la solicitud como adjuntos de la tarea de ClickUp.
// No se guardan en Firebase: viajan directo del formulario a ClickUp.
export async function uploadSolicitudImagesAction(taskId: string, formData: FormData): Promise<{ success: boolean; uploaded?: number; error?: string }> {
    try {
        const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
        if (files.length === 0) return { success: true, uploaded: 0 };
        const result = await uploadAttachmentsToTask(taskId, files);
        return {
            success: result.errors.length === 0,
            uploaded: result.uploaded,
            error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
        };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}
