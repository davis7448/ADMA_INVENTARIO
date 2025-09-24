
"use server";

import { z } from 'zod';
import { addProduct, updateProduct, uploadImageAndGetURL, createReservation, addMultipleProducts, auditProductStock, clearProductAudit, deleteProduct, updateProductLocation } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { Product, ProductVariant, User } from '@/lib/types';
import type { AddProductFormState, EditProductFormState, CreateReservationFormState, CreateReservationFormValues, ImportProductsFormState } from '@/lib/definitions';
import { AddProductFormSchema, EditProductFormSchema, CreateReservationFormSchema, ImportProductSchema } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';


export async function addProductAction(
  formData: FormData
): Promise<AddProductFormState> {

  const rawData = Object.fromEntries(formData.entries());
  
  const variantsData: Record<number, Partial<ProductVariant>> = {};
  const variantKeys = Object.keys(rawData).filter(key => key.startsWith('variants['));

  variantKeys.forEach(key => {
    const match = key.match(/variants\[(\d+)\]\.(id|name|sku|priceDropshipping|priceWholesale|stock)/);
    if (match) {
      const index = parseInt(match[1], 10);
      const field = match[2] as keyof ProductVariant;
      if (!variantsData[index]) {
        variantsData[index] = {};
      }
      (variantsData[index] as any)[field] = rawData[key];
    }
  });

  const variants: ProductVariant[] = Object.values(variantsData).map(v => ({
    id: (v.id as string) || uuidv4(),
    name: (v.name as string) || '',
    sku: (v.sku as string) || '',
    priceDropshipping: Number(v.priceDropshipping) || 0,
    priceWholesale: Number(v.priceWholesale) || 0,
    stock: Number(v.stock) || 0,
  }));
  
  const dataToValidate = {
    ...rawData,
    priceDropshipping: rawData.priceDropshipping ? Number(rawData.priceDropshipping) : undefined,
    priceWholesale: rawData.priceWholesale ? Number(rawData.priceWholesale) : undefined,
    cost: rawData.cost ? Number(rawData.cost) : undefined,
    stock: rawData.stock ? Number(rawData.stock) : undefined,
    purchaseDate: rawData.purchaseDate ? new Date(rawData.purchaseDate as string) : undefined,
    image: formData.get('image'),
    variants: variants,
  };

  const validatedFields = AddProductFormSchema.safeParse(dataToValidate);
  
  if (!validatedFields.success) {
    return {
      message: 'La validación falló. Por favor, revisa tus entradas.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  try {
    const { image, ...productData } = validatedFields.data;
    let imageUrl: string | null = null;
    if (image) {
        imageUrl = await uploadImageAndGetURL(image);
    }


    const newProduct: Omit<Product, 'id'> = {
      ...productData,
      productType: productData.productType,
      priceDropshipping: productData.priceDropshipping ?? 0,
      priceWholesale: productData.priceWholesale ?? 0,
      stock: productData.stock ?? 0,
      purchaseDate: productData.purchaseDate?.toISOString(),
      imageUrl: imageUrl || `https://picsum.photos/seed/${productData.sku || uuidv4()}/600/400`,
      imageHint: 'nuevo producto', // This could be improved with AI
    };
    
    const newProductId = await addProduct(newProduct);
    
    revalidatePath('/products');

    return {
      message: `Producto añadido con éxito. Nuevo ID de Producto: ${newProductId}`,
      success: true,
    };
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
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
    
    const rawData: Record<string, any> = {};
    const variantsData: Record<number, Partial<ProductVariant>> = {};
    
    // Manually parse variants from FormData
    for (const [key, value] of formData.entries()) {
        const variantMatch = key.match(/variants\[(\d+)\]\.(id|name|sku|priceDropshipping|priceWholesale|stock)/);
        if (variantMatch) {
          const index = parseInt(variantMatch[1], 10);
          const field = variantMatch[2] as keyof ProductVariant;
          
          if (!variantsData[index]) {
            variantsData[index] = {};
          }
          (variantsData[index] as any)[field] = value;
    
        } else {
          rawData[key] = value;
        }
      }

    const variants: ProductVariant[] = Object.values(variantsData).map(v => ({
        id: (v.id as string) || uuidv4(),
        name: (v.name as string) || '',
        sku: (v.sku as string) || '',
        priceDropshipping: Number(v.priceDropshipping) || 0,
        priceWholesale: Number(v.priceWholesale) || 0,
        stock: Number(v.stock) || 0,
    }));

    rawData.variants = variants;
    
    const purchaseDate = formData.get('purchaseDate');

    const validatedFields = EditProductFormSchema.safeParse({
        ...rawData,
        image: formData.get('image'),
        priceDropshipping: rawData.priceDropshipping ? Number(rawData.priceDropshipping) : undefined,
        priceWholesale: rawData.priceWholesale ? Number(rawData.priceWholesale) : undefined,
        cost: rawData.cost ? Number(rawData.cost) : undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate as string) : undefined,
        stock: rawData.stock ? Number(rawData.stock) : undefined,
        variants: rawData.variants,
    });
  
    if (!validatedFields.success) {
        return {
            message: 'La validación falló. Por favor, revisa tus entradas.',
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
            priceWholesale: productData.priceWholesale ?? 0,
            stock: productData.stock ?? 0,
            purchaseDate: productData.purchaseDate?.toISOString(),
        };

        if (imageUrl) {
            productUpdate.imageUrl = imageUrl;
        }
        
        // The cost field is only present in validatedFields.data if the admin user submitted it.
        // If not, it will be undefined and won't be included in the update, preserving the existing value.
        if (validatedFields.data.cost !== undefined) {
            productUpdate.cost = validatedFields.data.cost;
        }

        await updateProduct(productId, productUpdate);
        revalidatePath('/products');

        return {
            message: 'Producto actualizado con éxito.',
            success: true,
        };
    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        return {
            message: errorMessage,
            success: false,
        };
    }
}

export async function deleteProductAction(
    productId: string,
    user: User | null
): Promise<{ success: boolean; message: string }> {
    if (!user || user.role !== 'admin') {
        return { success: false, message: 'No tienes permiso para realizar esta acción.' };
    }

    try {
        await deleteProduct(productId, user);
        revalidatePath('/products');
        revalidatePath('/history');
        return { success: true, message: 'Producto eliminado con éxito.' };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        return { success: false, message: errorMessage };
    }
}


export async function createReservationAction(
    productId: string,
    data: CreateReservationFormValues,
    user: User | null
): Promise<CreateReservationFormState> {
    const validatedFields = CreateReservationFormSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
          message: 'La validación falló. Por favor, revisa tus entradas.',
          errors: validatedFields.error.flatten().fieldErrors,
          success: false,
        };
    }

    try {
        await createReservation({ 
            productId, 
            ...validatedFields.data, 
            createdBy: user ? { id: user.id, name: user.name } : undefined 
        });
        revalidatePath('/products');
        revalidatePath('/stale-reservations'); // Revalidate alerts page too
        return {
            message: 'Reserva creada con éxito.',
            success: true,
        };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        return {
            message: errorMessage,
            success: false,
        };
    }
}

export async function importProductsAction(
    products: unknown[],
    user: User | null
): Promise<ImportProductsFormState> {
    
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
            const product: Partial<Omit<Product, 'id'>> = {
                name: p.name,
                sku: p.sku,
                description: p.description,
                priceDropshipping: p.pricedropshipping,
                priceWholesale: p.pricewholesale ?? 0,
                cost: p.cost,
                stock: p.stock,
                categoryId: p.categoryid,
                vendorId: p.vendorid,
                productType: 'simple',
                variants: [],
                pendingStock: 0,
                damagedStock: 0,
                purchaseDate: p.purchasedate ? new Date(p.purchasedate).toISOString() : undefined,
                imageUrl: `https://picsum.photos/seed/${p.sku || uuidv4()}/600/400`,
                imageHint: 'producto',
            };
            if (user) {
              product.createdBy = { id: user.id, name: user.name };
            }
            if (product.cost === undefined || product.cost === null) {
                delete product.cost;
            }
            return product as Omit<Product, 'id'>;
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

export async function auditProductStockAction(productId: string, auditedBy: string): Promise<{ success: boolean, message: string }> {
    try {
        await auditProductStock(productId, auditedBy);
        revalidatePath('/products');

        return {
            message: 'Stock auditado con éxito.',
            success: true,
        };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        return {
            message: errorMessage,
            success: false,
        };
    }
}

export async function clearProductAuditAction(productId: string): Promise<{ success: boolean, message: string }> {
    try {
        await clearProductAudit(productId);
        revalidatePath('/products');

        return {
            message: 'Auditoría eliminada con éxito.',
            success: true,
        };

    } catch (error) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        return {
            message: errorMessage,
            success: false,
        };
    }
}

export async function updateProductLocationAction(productId: string, locationId: string | null): Promise<{ success: boolean; message: string }> {
    try {
        await updateProductLocation(productId, locationId);
        revalidatePath('/products');
        return { success: true, message: 'Ubicación del producto actualizada.' };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'No se pudo actualizar la ubicación.';
        return { success: false, message: errorMessage };
    }
}
