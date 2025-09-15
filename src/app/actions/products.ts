
"use server";

import { z } from 'zod';
import { addProduct, uploadImageAndGetURL } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { Product } from '@/lib/types';
import type { AddProductFormState } from '@/lib/definitions';

// This schema is used for parsing FormData on the server side.
const AddProductActionSchema = z.object({
  name: z.string().min(1, 'Product name is required.'),
  sku: z.string().min(1, 'SKU is required.'),
  description: z.string().min(1, 'Description is required.'),
  categoryId: z.string().min(1, 'Category is required.'),
  vendorId: z.string().min(1, 'Supplier is required.'),
  price: z.coerce.number().min(0, 'Price must be non-negative.').optional(),
  stock: z.coerce.number().int().min(0, 'Stock must be non-negative.').optional(),
  restockThreshold: z.coerce.number().int().min(0, 'Restock threshold must be non-negative.').optional(),
  image: z.instanceof(File, { message: 'Image is required.' }).refine(file => file.size > 0, 'Image cannot be empty.'),
});


export async function addProductAction(
  prevState: AddProductFormState,
  formData: FormData
): Promise<AddProductFormState> {

  const validatedFields = AddProductActionSchema.safeParse({
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
    const imageFile = validatedFields.data.image as File;
    const imageUrl = await uploadImageAndGetURL(imageFile);

    const newProduct: Omit<Product, 'id'> = {
      ...validatedFields.data,
      price: validatedFields.data.price ?? 0,
      stock: validatedFields.data.stock ?? 0,
      restockThreshold: validatedFields.data.restockThreshold ?? 0,
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
