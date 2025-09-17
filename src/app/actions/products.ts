
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
        variants[index] = { id: uuidv4(), name: '', sku: '', priceDropshipping: 0, stock: 0 };
      }
      (variants[index] as any)[field] = value;
    } else {
      rawData[key] = value;
    }
  }

  rawData.variants = variants.filter(Boolean); // Clean up any empty slots

  const purchaseDate = formData.get('purchaseDate');

  const validatedFields = AddProductFormSchema.safeParse({
    ...rawData,
    image: formData.get('image'),
    priceDropshipping: rawData.priceDropshipping ? Number(rawData.priceDropshipping) : undefined,
    priceWholesale: rawData.priceWholesale ? Number(rawData.priceWholesale) : undefined,
    cost: rawData.cost ? Number(rawData.cost) : undefined,
    purchaseDate: purchaseDate ? new Date(purchaseDate as string) : undefined,
    stock: rawData.stock ? Number(rawData.stock) : undefined,
    variants: rawData.variants.map((v: any) => ({
      ...v,
      priceDropshipping: Number(v.priceDropshipping),
      priceWholesale: Number(v.priceWholesale),
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
      priceDropshipping: productData.priceDropshipping ?? 0,
      stock: productData.stock ?? 0,
      purchaseDate: productData.purchaseDate?.toISOString(),
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
    // This is the most reliable way to get the user in a server action.
    // We'll wait for it, but with a timeout.
    const firebaseUser = await new Promise<import('firebase/auth').User | null>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Authentication timed out."));
        }, 5000); // 5 second timeout
        const unsubscribe = auth.onAuthStateChanged(user => {
            clearTimeout(timeout);
            unsubscribe();
            resolve(user);
        }, reject);
    });

    if (!firebaseUser?.email) {
        return { message: 'Authentication required. Please log in.', success: false };
    }
    
    const rawData: Record<string, any> = {};
    const variants: ProductVariant[] = [];
    
    // Manually parse variants from FormData
    for (const [key, value] of formData.entries()) {
        const variantMatch = key.match(/variants\[(\d+)\]\.(id|name|sku|priceDropshipping|priceWholesale|stock)/);
        if (variantMatch) {
            const index = parseInt(variantMatch[1], 10);
            const field = variantMatch[2];
            if (!variants[index]) {
                variants[index] = { id: '', name: '', sku: '', priceDropshipping: 0, priceWholesale: 0, stock: 0 };
            }
            (variants[index] as any)[field] = value;
        } else {
            rawData[key] = value;
        }
    }
    rawData.variants = variants.filter(Boolean); // Clean up any empty slots
    
    const purchaseDate = formData.get('purchaseDate');

    const validatedFields = EditProductFormSchema.safeParse({
        ...rawData,
        image: formData.get('image'),
        priceDropshipping: rawData.priceDropshipping ? Number(rawData.priceDropshipping) : undefined,
        priceWholesale: rawData.priceWholesale ? Number(rawData.priceWholesale) : undefined,
        cost: rawData.cost ? Number(rawData.cost) : undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate as string) : undefined,
        stock: rawData.stock ? Number(rawData.stock) : undefined,
        variants: rawData.variants.map((v: any) => ({
            ...v,
            priceDropshipping: Number(v.priceDropshipping),
            priceWholesale: Number(v.priceWholesale),
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
            priceDropshipping: productData.priceDropshipping ?? 0,
            stock: productData.stock ?? 0,
            purchaseDate: productData.purchaseDate?.toISOString(),
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

    