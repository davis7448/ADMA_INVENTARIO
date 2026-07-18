"use server";

import { createClickUpTaskForSolicitud, uploadAttachmentsToTask } from '@/lib/clickup';

// La solicitud ya existe en ADMA; esto crea su tarea espejo en ClickUp.
export async function syncSolicitudToClickUpAction(modificacionId: string): Promise<{ success: boolean; taskId?: string; error?: string }> {
    return createClickUpTaskForSolicitud(modificacionId);
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
