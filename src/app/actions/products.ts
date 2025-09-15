
"use server";

import { z } from 'zod';
import { addProduct, uploadImageAndGetURL } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { Product } from '@/lib/types';
import type { AddProductFormState } from '@/lib/definitions';
import { AddProductFormSchema } from '@/lib/definitions';


export async function addProductAction(
  formData: FormData
): Promise<AddProductFormState> {

  const validatedFields = AddProductFormSchema.safeParse({
    name: formData.get('name'),
    sku: formData.get('sku'),
    description: formData.get('description'),
    categoryId: formData.get('categoryId'),
    vendorId: formData.get('vendorId'),
    price: formData.get('price'),
    stock: formData.get('stock'),
    restockThreshold: formData.get('restockThreshold'),
    image: formData.get('image'),
  });
  
  if (!validatedFields.success) {
    return {
      message: 'Validation failed. Please check your inputs.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  try {
    const { image, ...productData } = validatedFields.data;
    const imageUrl = await uploadImageAndGetURL(image);

    const newProduct: Omit<Product, 'id'> = {
      ...productData,
      price: productData.price ?? 0,
      stock: productData.stock ?? 0,
      restockThreshold: productData.restockThreshold ?? 0,
      imageUrl: imageUrl,
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
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return {
      message: errorMessage,
      success: false,
    };
  }
}
