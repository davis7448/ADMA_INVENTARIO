
"use server";

import { registerInventoryEntry } from '@/lib/api';
import type { LogisticItem, User } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function registerInventoryEntryAction(
    items: (LogisticItem & { trackingNumber?: string })[], 
    user: User | null,
    reasonLabel: string,
    supplierId?: string,
    carrierId?: string,
): Promise<{ success: boolean; message: string, count: number }> {
    if (!items || items.length === 0) {
        return { success: false, message: "No hay items para registrar.", count: 0 };
    }

    try {
        await registerInventoryEntry(items, user, reasonLabel, supplierId, carrierId);
        revalidatePath('/logistics');
        revalidatePath('/products');
        revalidatePath('/history');

        return {
            success: true,
            message: 'Las entradas de inventario se registraron correctamente.',
            count: items.length
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        console.error("Error registering inventory entry:", error);
        return { success: false, message: errorMessage, count: 0 };
    }
}
