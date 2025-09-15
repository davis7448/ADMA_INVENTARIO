
"use server";

import { z } from 'zod';
import { addProduct } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { Product } from '@/lib/types';
import type { AddProductFormState, AddProductFormValues } from '@/lib/definitions';
import { AddProductFormSchema } from '@/lib/definitions';

export async function addProductAction(
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
      price: validatedFields.data.price ?? 0,
      stock: validatedFields.data.stock ?? 0,
      restockThreshold: validatedFields.data.restockThreshold ?? 0,
      imageHint: 'new product', // This could be improved with AI
    };
    
    const newProductId = await addProduct(newProduct);
    
    revalidatePath('/products');

    return {
      message: `Product added successfully. New Product ID: ${newProductId}`,
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
