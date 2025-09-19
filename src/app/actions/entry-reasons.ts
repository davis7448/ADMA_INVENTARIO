
"use server";

import { revalidatePath } from 'next/cache';
import { updateEntryReasons } from '@/lib/api';
import type { EntryReason } from '@/lib/types';

export async function updateEntryReasonsAction(
  reasons: EntryReason[]
): Promise<{ success: boolean; message: string }> {
  try {
    await updateEntryReasons(reasons);
    revalidatePath('/settings');
    revalidatePath('/logistics');
    return { success: true, message: 'Los conceptos de ingreso se han actualizado correctamente.' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
    return { success: false, message: errorMessage };
  }
}
