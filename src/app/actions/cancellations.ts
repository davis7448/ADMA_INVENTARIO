

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
        const { alreadyDispatched } = await createCancellationRequests(trackingNumbers, user);
        
        revalidatePath('/cancellations');

        let message = `Se procesaron ${trackingNumbers.length} guías.`;
        if (alreadyDispatched.length > 0) {
            message += ` ${alreadyDispatched.length} de ellas ya habían sido despachadas.`;
        }

        return {
            success: true,
            message: message,
            warnings: alreadyDispatched,
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        return { success: false, message: errorMessage };
    }
}
