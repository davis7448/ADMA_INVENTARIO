"use server";

import { z } from 'zod';
import { addProductToData } from '@/lib/data';
import { revalidatePath } from 'next/cache';
import type { Product } from '@/lib/types';
import type { AddProductFormState, AddProductFormValues } from '@/lib/definitions';
import { AddProductFormSchema } from '@/lib/definitions';

export async function addProduct(
  data: AddProductFormValues
): Promise<AddProductFormState> {
  const validatedFields = AddProductFormSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      message: 'Validation failed. Please check your inputs.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  try {
    const newProduct: Omit<Product, 'id'> = {
      ...validatedFields.data,
      imageUrl: 'https://placehold.co/600x400',
      imageHint: 'placeholder',
    };
    
    addProductToData(newProduct);
    
    revalidatePath('/products');

    return {
      message: 'Product added successfully.',
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
