
"use server";

import { z } from 'zod';
import { addProduct, updateProduct, uploadImageAndGetURL, findUserByEmail, createReservation } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { Product, ProductVariant } from '@/lib/types';
import type { AddProductFormState, EditProductFormState, CreateReservationFormState, CreateReservationFormValues } from '@/lib/definitions';
import { AddProductFormSchema, EditProductFormSchema, CreateReservationFormSchema } from '@/lib/definitions';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';


export async function addProductAction(
  formData: FormData
): Promise<AddProductFormState> {
  
  const rawData: Record<string, any> = {};
  const variants: ProductVariant[] = [];
  
  // Manually parse variants from FormData
  for (const [key, value] of formData.entries()) {
    const variantMatch = key.match(/variants\[(\d+)\]\.(name|sku|price|stock)/);
    if (variantMatch) {
      const index = parseInt(variantMatch[1], 10);
      const field = variantMatch[2];
      if (!variants[index]) {
        variants[index] = { id: uuidv4(), name: '', sku: '', price: 0, stock: 0 };
      }
      (variants[index] as any)[field] = value;
    } else {
      rawData[key] = value;
    }
  }

  rawData.variants = variants.filter(Boolean); // Clean up any empty slots

  const validatedFields = AddProductFormSchema.safeParse({
    ...rawData,
    image: formData.get('image'),
    price: rawData.price ? Number(rawData.price) : undefined,
    stock: rawData.stock ? Number(rawData.stock) : undefined,
    restockThreshold: rawData.restockThreshold ? Number(rawData.restockThreshold) : undefined,
    variants: rawData.variants.map((v: any) => ({
      ...v,
      price: Number(v.price),
      stock: Number(v.stock),
    })),
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

export async function updateProductAction(
    productId: string,
    formData: FormData
  ): Promise<EditProductFormState> {
    const auth = getAuth(app);
    const firebaseUser = auth.currentUser;

    if (!firebaseUser?.email) {
        return { message: 'Authentication required.', success: false };
    }

    const appUser = await findUserByEmail(firebaseUser.email);

    if (appUser?.role !== 'admin') {
        return { message: 'Permission denied. You do not have access to this feature.', success: false };
    }
    
    const rawData: Record<string, any> = {};
    const variants: ProductVariant[] = [];
    
    // Manually parse variants from FormData
    for (const [key, value] of formData.entries()) {
        const variantMatch = key.match(/variants\[(\d+)\]\.(id|name|sku|price|stock)/);
        if (variantMatch) {
            const index = parseInt(variantMatch[1], 10);
            const field = variantMatch[2];
            if (!variants[index]) {
                variants[index] = { id: '', name: '', sku: '', price: 0, stock: 0 };
            }
            (variants[index] as any)[field] = value;
        } else {
            rawData[key] = value;
        }
    }
    rawData.variants = variants.filter(Boolean); // Clean up any empty slots

    const validatedFields = EditProductFormSchema.safeParse({
        ...rawData,
        image: formData.get('image'),
        price: rawData.price ? Number(rawData.price) : undefined,
        stock: rawData.stock ? Number(rawData.stock) : undefined,
        restockThreshold: rawData.restockThreshold ? Number(rawData.restockThreshold) : undefined,
        variants: rawData.variants.map((v: any) => ({
            ...v,
            price: Number(v.price),
            stock: Number(v.stock),
            id: v.id || uuidv4()
        })),
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
        let imageUrl: string | undefined = undefined;

        // If a new image is provided, upload it and get the new URL
        const imageFile = formData.get('image');
        if (imageFile instanceof File && imageFile.size > 0) {
            imageUrl = await uploadImageAndGetURL(imageFile);
        }

        const productUpdate: Partial<Omit<Product, 'id'>> = {
            ...productData,
            price: productData.price ?? 0,
            stock: productData.stock ?? 0,
            restockThreshold: productData.restockThreshold ?? 0,
        };

        if (imageUrl) {
            productUpdate.imageUrl = imageUrl;
        }

        await updateProduct(productId, productUpdate);
        revalidatePath('/products');

        return {
            message: 'Product updated successfully.',
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

export async function createReservationAction(productId: string, data: CreateReservationFormValues): Promise<CreateReservationFormState> {
    const validatedFields = CreateReservationFormSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
          message: 'Validation failed. Please check your inputs.',
          errors: validatedFields.error.flatten().fieldErrors,
          success: false,
        };
    }

    try {
        await createReservation({ productId, ...validatedFields.data });
        revalidatePath('/products');
        revalidatePath('/stale-reservations'); // Revalidate alerts page too
        return {
            message: 'Reserva creada con éxito.',
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
