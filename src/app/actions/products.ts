"use server";

import { z } from 'zod';
import { addProduct as addProductToData } from '@/lib/data';
import { revalidatePath } from 'next/cache';

const AddProductFormSchema = z.object({
  name: z.string().min(1, 'Product name is required.'),
  sku: z.string().min(1, 'SKU is required.'),
  description: z.string().min(1, 'Description is required.'),
  category: z.string().min(1, 'Category is required.'),
  vendorId: z.string().min(1, 'Supplier is required.'),
  price: z.coerce.number().min(0, 'Price must be a non-negative number.'),
  stock: z.coerce.number().min(0, 'Stock must be a non-negative number.'),
  restockThreshold: z.coerce.number().min(0, 'Threshold must be a non-negative number.'),
});

export type AddProductFormState = {
  message: string;
  errors?: {
    name?: string[];
    sku?: string[];
    description?: string[];
    category?: string[];
    vendorId?: string[];
    price?: string[];
    stock?: string[];
    restockThreshold?: string[];
  };
  success: boolean;
};

export async function addProduct(
  prevState: AddProductFormState,
  formData: FormData
): Promise<AddProductFormState> {
  const validatedFields = AddProductFormSchema.safeParse({
    name: formData.get('name'),
    sku: formData.get('sku'),
    description: formData.get('description'),
    category: formData.get('category'),
    vendorId: formData.get('vendorId'),
    price: formData.get('price'),
    stock: formData.get('stock'),
    restockThreshold: formData.get('restockThreshold'),
  });

  if (!validatedFields.success) {
    return {
      message: 'Validation failed. Please check your inputs.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  try {
    const newProduct = {
      ...validatedFields.data,
      id: `prod-${Date.now()}`,
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
