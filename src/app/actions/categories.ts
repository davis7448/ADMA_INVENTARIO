
"use server";

import { z } from 'zod';
import { addCategory } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { AddCategoryFormState, AddCategoryFormValues } from '@/lib/definitions';
import { AddCategoryFormSchema } from '@/lib/definitions';

export async function addCategoryAction(
  data: AddCategoryFormValues
): Promise<AddCategoryFormState> {
  const validatedFields = AddCategoryFormSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      message: 'La validación falló. Por favor, revisa tus entradas.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  try {
    const newCategoryId = await addCategory(validatedFields.data);
    revalidatePath('/categories');

    return {
      message: `Categoría añadida con éxito. Nuevo ID de Categoría: ${newCategoryId}`,
      success: true,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.',
      success: false,
    };
  }
}
