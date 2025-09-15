
"use server";

import { addVendedor } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { Vendedor } from '@/lib/types';
import type { AddVendedorFormState, AddVendedorFormValues } from '@/lib/definitions';
import { AddVendedorFormSchema } from '@/lib/definitions';

export async function addVendedorAction(
  data: AddVendedorFormValues
): Promise<AddVendedorFormState> {
  const validatedFields = AddVendedorFormSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      message: 'La validación falló. Por favor revisa tus entradas.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  try {
    const newVendedor: Omit<Vendedor, 'id'> = {
      ...validatedFields.data,
    };
    
    const newVendedorId = await addVendedor(newVendedor);
    
    revalidatePath('/vendedores');

    return {
      message: `Vendedor añadido con éxito. Nuevo ID: ${newVendedorId}`,
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
