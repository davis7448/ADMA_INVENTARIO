
"use server";

import { z } from 'zod';
import { addSupplier } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { Supplier } from '@/lib/types';
import type { AddSupplierFormState, AddSupplierFormValues } from '@/lib/definitions';
import { AddSupplierFormSchema } from '@/lib/definitions';

export async function addSupplierAction(
  data: AddSupplierFormValues
): Promise<AddSupplierFormState> {
  const validatedFields = AddSupplierFormSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      message: 'Validation failed. Please check your inputs.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  try {
    const newSupplier: Omit<Supplier, 'id' | 'productCount'> = {
      ...validatedFields.data,
    };
    
    const newSupplierId = await addSupplier(newSupplier);
    
    revalidatePath('/suppliers');

    return {
      message: `Supplier added successfully. New Supplier ID: ${newSupplierId}`,
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
