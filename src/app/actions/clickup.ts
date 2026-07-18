"use server";

import { createClickUpTaskForSolicitud } from '@/lib/clickup';

// La solicitud ya existe en ADMA; esto crea su tarea espejo en ClickUp.
export async function syncSolicitudToClickUpAction(modificacionId: string): Promise<{ success: boolean; taskId?: string; error?: string }> {
    return createClickUpTaskForSolicitud(modificacionId);
}
