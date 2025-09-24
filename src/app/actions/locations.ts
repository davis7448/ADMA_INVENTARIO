
"use server";

import { revalidatePath } from 'next/cache';
import { addLocation, updateLocation } from '@/lib/api';

export async function updateLocationAction(
  id: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  try {
    await updateLocation(id, name);
    revalidatePath('/settings');
    revalidatePath('/products');
    return { success: true, message: 'Ubicación actualizada correctamente.' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
    return { success: false, message: errorMessage };
  }
}

export async function addLocationAction(
    name: string
  ): Promise<{ success: boolean; message: string; newId?: string }> {
    try {
      const newId = await addLocation(name);
      revalidatePath('/settings');
      revalidatePath('/products');
      return { success: true, message: 'Ubicación añadida correctamente.', newId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
      return { success: false, message: errorMessage };
    }
  }
