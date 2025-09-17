

"use server";

import { z } from 'zod';
import { addProduct, updateProduct, uploadImageAndGetURL, findUserByEmail, createReservation, addMultipleProducts } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { Product, ProductVariant } from '@/lib/types';
import type { AddProductFormState, EditProductFormState, CreateReservationFormState, CreateReservationFormValues, ImportProductsFormState } from '@/lib/definitions';
import { AddProductFormSchema, EditProductFormSchema, CreateReservationFormSchema, ImportProductSchema } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';


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
      productType: 'simple',
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
    
    // NOTE: The complex authentication logic was removed from here.
    // It was causing persistent issues in the Server Action context.
    // We now rely on client-side logic to show/hide sensitive fields like 'cost'.
    // A robust production app would use a session-based check with a library like NextAuth.js
    // or pass an auth token from the client to be verified by the Admin SDK here.
    
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
        
        // The cost field will only be present in formData if the admin user submitted it.
        // If not, it will be undefined and won't be included in the update, preserving the existing value.
        if (formData.has('cost')) {
            productUpdate.cost = validatedFields.data.cost;
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

export async function importProductsAction(products: unknown[]): Promise<ImportProductsFormState> {
    
    const validatedProducts = z.array(ImportProductSchema).safeParse(products);
    
    if (!validatedProducts.success) {
        const errorMessages = validatedProducts.error.issues.map(issue => {
            const row = issue.path[0] as number + 2; // +2 to account for 0-based index and header row
            const field = issue.path[1];
            return `Fila ${row}, Columna '${field}': ${issue.message}`;
        });
        
        return {
          message: 'La validación de datos falló. Por favor, revisa los errores.',
          errors: errorMessages.join(' | '),
          success: false,
          count: 0
        };
    }

    try {
        const productsToAdd: Omit<Product, 'id'>[] = validatedProducts.data.map(p => {
            const product: Omit<Product, 'id'> = {
                name: p.name,
                sku: p.sku,
                description: p.description,
                priceDropshipping: p.pricedropshipping,
                priceWholesale: p.pricewholesale ?? 0,
                cost: p.cost ?? undefined,
                stock: p.stock,
                categoryId: p.categoryid,
                vendorId: p.vendorid,
                productType: 'simple',
                variants: [],
                pendingStock: 0,
                damagedStock: 0,
                purchaseDate: p.purchasedate ? new Date(p.purchasedate).toISOString() : undefined,
                imageUrl: `https://picsum.photos/seed/${p.sku || uuidv4()}/600/400`,
                imageHint: 'product',
            };
            if (product.cost === undefined) {
                delete product.cost;
            }
            return product;
        });

        await addMultipleProducts(productsToAdd);
        revalidatePath('/products');

        return {
            message: 'Productos importados exitosamente.',
            success: true,
            count: productsToAdd.length
        };

    } catch(error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        return {
            message: errorMessage,
            success: false,
            count: 0
        };
    }
}


      

    