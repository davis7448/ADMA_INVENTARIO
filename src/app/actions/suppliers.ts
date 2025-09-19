
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
      message: 'La validación falló. Por favor, revisa tus entradas.',
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
      message: `Proveedor añadido con éxito. Nuevo ID de Proveedor: ${newSupplierId}`,
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
