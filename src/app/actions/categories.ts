
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
      message: 'Validation failed. Please check your inputs.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  try {
    const newCategoryId = await addCategory(validatedFields.data);
    revalidatePath('/categories');

    return {
      message: `Category added successfully. New Category ID: ${newCategoryId}`,
      success: true,
    };
  } catch (error) {
    console.error(error);
    return {
      message: 'An unexpected error occurred. Please try again.',
      success: false,
    };
  }
}
