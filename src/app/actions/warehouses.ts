
"use server";

import { revalidatePath } from 'next/cache';
import { addWarehouse, updateWarehouse } from '@/lib/api';

export async function updateWarehouseAction(
  id: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  try {
    await updateWarehouse(id, name);
    revalidatePath('/settings');
    return { success: true, message: 'Bodega actualizada correctamente.' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
    return { success: false, message: errorMessage };
  }
}

export async function addWarehouseAction(
    name: string,
    type: 'internal' | 'external' = 'internal',
    externalProvider?: string
  ): Promise<{ success: boolean; message: string; newId?: string }> {
    try {
      const newId = await addWarehouse(name, type, externalProvider);
      revalidatePath('/settings');
      revalidatePath('/external-warehouses');
      return { success: true, message: 'Bodega añadida correctamente.', newId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      return { success: false, message: errorMessage };
    }
  }
