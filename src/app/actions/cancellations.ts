

"use server";

import { createCancellationRequests, getCancellationRequests } from '@/lib/api';
import type { User } from '@/lib/types';
import { revalidatePath } from 'next/cache';

interface FormState {
    message: string;
    success: boolean;
    warnings?: string[];
}

export async function createCancellationRequestsAction(
    trackingNumbers: string[],
    user: User | null,
): Promise<FormState> {
    if (!user) {
        return { success: false, message: "Usuario no autenticado." };
    }

    if (trackingNumbers.length === 0) {
        return { success: false, message: "No se proporcionaron guías para anular." };
    }

    try {
        const CHUNK_SIZE = 30;
        const allAlreadyDispatched: string[] = [];
        const allPendingOrders: string[] = [];

        for (let i = 0; i < trackingNumbers.length; i += CHUNK_SIZE) {
            const chunk = trackingNumbers.slice(i, i + CHUNK_SIZE);
            const { alreadyDispatched, pendingOrders } = await createCancellationRequests(chunk, user);
            allAlreadyDispatched.push(...alreadyDispatched);
            allPendingOrders.push(...pendingOrders);
        }

        revalidatePath('/cancellations');

        let message = `Se procesaron ${trackingNumbers.length} guías.`;
        if (allAlreadyDispatched.length > 0) {
            message += ` ${allAlreadyDispatched.length} de ellas ya habían sido despachadas.`;
        }

        return {
            success: true,
            message: message,
            warnings: allAlreadyDispatched,
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        return { success: false, message: errorMessage };
    }
}
