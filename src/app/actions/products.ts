
"use server";

import { z } from 'zod';
import { addProduct, updateProduct, uploadImageAndGetURL, createReservation, addMultipleProducts, auditProductStock, clearProductAudit, deleteProduct, updateProductLocation } from '@/lib/api';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { Product, ProductVariant, User } from '@/lib/types';
import type { AddProductFormState, EditProductFormState, CreateReservationFormState, CreateReservationFormValues, ImportProductsFormState } from '@/lib/definitions';
import { AddProductFormSchema, EditProductFormSchema, CreateReservationFormSchema, ImportProductSchema, UpdateProductSchema } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';

export type CostPriceUpdateInput = {
    rowNumber: number;
    sku: string;
    cost?: number | null;
    priceDropshipping?: number | null;
    priceMinSale?: number | null;
    priceOptimalSale?: number | null;
};

export type SkuConflict = {
    productId: string;
    productName: string;
    variantId?: string;
    variantName?: string;
    targetType: 'product' | 'variant';
};

export type CostPriceUpdatePreviewRow = CostPriceUpdateInput & {
    productId?: string;
    productName?: string;
    variantId?: string;
    variantName?: string;
    targetType?: 'product' | 'variant';
    currentCost?: number | null;
    currentPriceDropshipping?: number | null;
    currentPriceMinSale?: number | null;
    currentPriceOptimalSale?: number | null;
    status: 'valid' | 'no-change' | 'not-found' | 'duplicate-file' | 'duplicate-system' | 'invalid';
    message: string;
    conflicts?: SkuConflict[];
};

export type CostPriceUpdatePreview = {
    success: boolean;
    message: string;
    rows: CostPriceUpdatePreviewRow[];
    summary: {
        total: number;
        valid: number;
        noChange: number;
        notFound: number;
        duplicateFile: number;
        duplicateSystem: number;
        invalid: number;
    };
};

const canManageCostPriceUpdates = (user: User | null) => user?.role === 'admin' || user?.role === 'plataformas';

const normalizeUpdateNumber = (value?: number | null) => (
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const valuesEqual = (a?: number | null, b?: number | null) => {
    const left = normalizeUpdateNumber(a);
    const right = normalizeUpdateNumber(b);
    return left === right;
};

async function buildCostPricePreview(rows: CostPriceUpdateInput[]): Promise<CostPriceUpdatePreview> {
    const sanitizedRows = rows.map(row => ({
        ...row,
        sku: String(row.sku || '').trim(),
        cost: normalizeUpdateNumber(row.cost),
        priceDropshipping: normalizeUpdateNumber(row.priceDropshipping),
        priceMinSale: normalizeUpdateNumber(row.priceMinSale),
        priceOptimalSale: normalizeUpdateNumber(row.priceOptimalSale),
    }));

    const skuCounts = sanitizedRows.reduce((acc, row) => {
        if (row.sku) acc[row.sku] = (acc[row.sku] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const productsSnapshot = await getDocs(collection(db, 'products'));
    const matchesBySku: Record<string, CostPriceUpdatePreviewRow[]> = {};

    productsSnapshot.docs.forEach(productDoc => {
        const product = { id: productDoc.id, ...productDoc.data() } as Product;
        if (product.sku) {
            const sku = String(product.sku).trim();
            matchesBySku[sku] = matchesBySku[sku] || [];
            matchesBySku[sku].push({
                rowNumber: 0,
                sku,
                productId: product.id,
                productName: product.name,
                targetType: 'product',
                currentCost: product.cost ?? null,
                currentPriceDropshipping: product.priceDropshipping ?? null,
                currentPriceMinSale: product.priceMinSale ?? null,
                currentPriceOptimalSale: product.priceOptimalSale ?? null,
                status: 'valid',
                message: '',
            });
        }

        product.variants?.forEach(variant => {
            const sku = String(variant.sku || '').trim();
            if (!sku) return;
            matchesBySku[sku] = matchesBySku[sku] || [];
            matchesBySku[sku].push({
                rowNumber: 0,
                sku,
                productId: product.id,
                productName: product.name,
                variantId: variant.id,
                variantName: variant.name,
                targetType: 'variant',
                currentCost: variant.cost ?? null,
                currentPriceDropshipping: variant.priceDropshipping ?? null,
                currentPriceMinSale: variant.priceMinSale ?? null,
                currentPriceOptimalSale: variant.priceOptimalSale ?? null,
                status: 'valid',
                message: '',
            });
        });
    });

    const previewRows: CostPriceUpdatePreviewRow[] = sanitizedRows.map(row => {
        const hasValue = row.cost !== undefined || row.priceDropshipping !== undefined || row.priceMinSale !== undefined || row.priceOptimalSale !== undefined;
        if (!row.sku) {
            return { ...row, status: 'invalid', message: 'Fila sin SKU.' };
        }
        if (!hasValue) {
            return { ...row, status: 'invalid', message: 'No hay costo, precio o guía para actualizar.' };
        }
        if (skuCounts[row.sku] > 1) {
            return { ...row, status: 'duplicate-file', message: 'SKU duplicado en el archivo.' };
        }

        const matches = matchesBySku[row.sku] || [];
        if (matches.length === 0) {
            return { ...row, status: 'not-found', message: 'SKU no encontrado en productos ni variantes.' };
        }
        if (matches.length > 1) {
            return {
                ...row,
                status: 'duplicate-system',
                message: `SKU duplicado en el sistema (${matches.length} coincidencias).`,
                conflicts: matches.map(m => ({
                    productId: m.productId!,
                    productName: m.productName!,
                    variantId: m.variantId,
                    variantName: m.variantName,
                    targetType: m.targetType!,
                })),
            };
        }

        const match = matches[0];
        const noChange =
            (row.cost === undefined || valuesEqual(row.cost, match.currentCost)) &&
            (row.priceDropshipping === undefined || valuesEqual(row.priceDropshipping, match.currentPriceDropshipping)) &&
            (row.priceMinSale === undefined || valuesEqual(row.priceMinSale, match.currentPriceMinSale)) &&
            (row.priceOptimalSale === undefined || valuesEqual(row.priceOptimalSale, match.currentPriceOptimalSale));

        return {
            ...row,
            productId: match.productId,
            productName: match.productName,
            variantId: match.variantId,
            variantName: match.variantName,
            targetType: match.targetType,
            currentCost: match.currentCost,
            currentPriceDropshipping: match.currentPriceDropshipping,
            currentPriceMinSale: match.currentPriceMinSale,
            currentPriceOptimalSale: match.currentPriceOptimalSale,
            status: noChange ? 'no-change' : 'valid',
            message: noChange ? 'Sin cambios.' : 'Listo para actualizar.',
        };
    });

    const summary = {
        total: previewRows.length,
        valid: previewRows.filter(row => row.status === 'valid').length,
        noChange: previewRows.filter(row => row.status === 'no-change').length,
        notFound: previewRows.filter(row => row.status === 'not-found').length,
        duplicateFile: previewRows.filter(row => row.status === 'duplicate-file').length,
        duplicateSystem: previewRows.filter(row => row.status === 'duplicate-system').length,
        invalid: previewRows.filter(row => row.status === 'invalid').length,
    };

    return {
        success: true,
        message: `Vista previa generada: ${summary.valid} filas aplicables.`,
        rows: previewRows,
        summary,
    };
}

export async function previewCostPriceUpdateAction(
    rows: CostPriceUpdateInput[],
    user: User | null
): Promise<CostPriceUpdatePreview> {
    if (!canManageCostPriceUpdates(user)) {
        return {
            success: false,
            message: 'No tienes permiso para actualizar costos y precios.',
            rows: [],
            summary: { total: 0, valid: 0, noChange: 0, notFound: 0, duplicateFile: 0, duplicateSystem: 0, invalid: 0 },
        };
    }

    try {
        return await buildCostPricePreview(rows);
    } catch (error) {
        console.error(error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'No se pudo generar la vista previa.',
            rows: [],
            summary: { total: 0, valid: 0, noChange: 0, notFound: 0, duplicateFile: 0, duplicateSystem: 0, invalid: 0 },
        };
    }
}

export async function applyCostPriceUpdateAction(
    rows: CostPriceUpdateInput[],
    user: User | null
): Promise<{ success: boolean; message: string; applied: number; skipped: number; preview: CostPriceUpdatePreview }> {
    if (!canManageCostPriceUpdates(user)) {
        return {
            success: false,
            message: 'No tienes permiso para actualizar costos y precios.',
            applied: 0,
            skipped: rows.length,
            preview: {
                success: false,
                message: 'Sin permiso.',
                rows: [],
                summary: { total: rows.length, valid: 0, noChange: 0, notFound: 0, duplicateFile: 0, duplicateSystem: 0, invalid: rows.length },
            },
        };
    }

    const preview = await buildCostPricePreview(rows);
    const validRows = preview.rows.filter(row => row.status === 'valid' && row.productId);

    try {
        for (const row of validRows) {
            const cost = normalizeUpdateNumber(row.cost);
            const priceDropshipping = normalizeUpdateNumber(row.priceDropshipping);
            const priceMinSale = normalizeUpdateNumber(row.priceMinSale);
            const priceOptimalSale = normalizeUpdateNumber(row.priceOptimalSale);
            const productRef = doc(db, 'products', row.productId!);
            const productSnap = await getDoc(productRef);
            if (!productSnap.exists()) continue;
            const product = { id: productSnap.id, ...productSnap.data() } as Product;

            if (row.targetType === 'variant' && row.variantId) {
                const variants = [...(product.variants || [])];
                const variantIndex = variants.findIndex(variant => variant.id === row.variantId || variant.sku === row.sku);
                if (variantIndex === -1) continue;
                variants[variantIndex] = {
                    ...variants[variantIndex],
                    ...(cost !== undefined ? { cost } : {}),
                    ...(priceDropshipping !== undefined ? { priceDropshipping } : {}),
                    ...(priceMinSale !== undefined ? { priceMinSale } : {}),
                    ...(priceOptimalSale !== undefined ? { priceOptimalSale } : {}),
                };
                await updateDoc(productRef, { variants });
            } else {
                const updateData: Partial<Product> = {};
                if (cost !== undefined) updateData.cost = cost;
                if (priceDropshipping !== undefined) updateData.priceDropshipping = priceDropshipping;
                if (priceMinSale !== undefined) updateData.priceMinSale = priceMinSale;
                if (priceOptimalSale !== undefined) updateData.priceOptimalSale = priceOptimalSale;
                await updateDoc(productRef, updateData);
            }
        }

        revalidatePath('/products');
        return {
            success: true,
            message: `Se actualizaron ${validRows.length} productos o variantes.`,
            applied: validRows.length,
            skipped: preview.rows.length - validRows.length,
            preview,
        };
    } catch (error) {
        console.error(error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'No se pudo aplicar la actualización.',
            applied: 0,
            skipped: preview.rows.length,
            preview,
        };
    }
}

export async function applyWholesalePriceUpdateAction(
    rows: { sku: string; priceWholesale: number }[],
    user: User | null
): Promise<{ success: boolean; message: string; count: number }> {
    if (!canManageCostPriceUpdates(user)) {
        return { success: false, message: 'No tienes permiso para actualizar precios mayoristas.', count: 0 };
    }

    try {
        let count = 0;
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const productMatches = new Map<string, Product & { id: string }>();
        const variantMatches = new Map<string, { product: Product & { id: string }; variantIndex: number }>();

        productsSnapshot.docs.forEach(productDoc => {
            const product = { id: productDoc.id, ...productDoc.data() } as Product & { id: string };
            if (product.sku) productMatches.set(String(product.sku).trim(), product);
            product.variants?.forEach((variant, variantIndex) => {
                if (variant.sku) variantMatches.set(String(variant.sku).trim(), { product, variantIndex });
            });
        });

        for (const row of rows) {
            const sku = String(row.sku || '').trim();
            const priceWholesale = Number(row.priceWholesale);
            if (!sku || !Number.isFinite(priceWholesale) || priceWholesale < 0) continue;

            const product = productMatches.get(sku);
            if (product) {
                await updateDoc(doc(db, 'products', product.id), { priceWholesale });
                count += 1;
                continue;
            }

            const variantMatch = variantMatches.get(sku);
            if (variantMatch) {
                const variants = [...(variantMatch.product.variants || [])];
                variants[variantMatch.variantIndex] = {
                    ...variants[variantMatch.variantIndex],
                    priceWholesale,
                };
                await updateDoc(doc(db, 'products', variantMatch.product.id), { variants });
                count += 1;
            }
        }

        revalidatePath('/products');
        return { success: true, message: `Se actualizaron ${count} precios mayoristas.`, count };
    } catch (error) {
        console.error(error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'No se pudieron actualizar los precios mayoristas.',
            count: 0,
        };
    }
}


export async function addProductAction(
  formData: FormData
): Promise<AddProductFormState> {

  const rawData = Object.fromEntries(formData.entries());
  
  const variantsData: Record<number, Partial<ProductVariant>> = {};
  const variantKeys = Object.keys(rawData).filter(key => key.startsWith('variants['));

  variantKeys.forEach(key => {
    const match = key.match(/variants\[(\d+)\]\.(id|name|sku|priceDropshipping|priceWholesale|cost|priceMinSale|priceOptimalSale|stock)/);
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
    cost: Number(v.cost) || 0,
    priceMinSale: v.priceMinSale !== undefined ? Number(v.priceMinSale) || 0 : undefined,
    priceOptimalSale: v.priceOptimalSale !== undefined ? Number(v.priceOptimalSale) || 0 : undefined,
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
      pendingStock: 0,
      damagedStock: 0,
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
        const variantMatch = key.match(/variants\[(\d+)\]\.(id|name|sku|priceDropshipping|priceWholesale|cost|priceMinSale|priceOptimalSale|stock)/);
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
        cost: Number(v.cost) || 0,
        priceMinSale: v.priceMinSale !== undefined ? Number(v.priceMinSale) || 0 : undefined,
        priceOptimalSale: v.priceOptimalSale !== undefined ? Number(v.priceOptimalSale) || 0 : undefined,
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
    user: User | null,
    warehouseId?: string
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
                warehouseId: p.warehouseid || warehouseId || 'wh-bog',
                productType: 'simple',
                variants: [],
                pendingStock: 0,
                damagedStock: 0,
                purchaseDate: p.purchasedate ? new Date(p.purchasedate).toISOString() : undefined,
                imageUrl: `https://picsum.photos/seed/${p.sku || uuidv4()}/600/400`,
                imageHint: 'producto',
                createdBy: user ? { id: user.id, name: user.name } : undefined,
            };
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

export async function updateProductsAction(
    products: unknown[],
    user: User | null
): Promise<ImportProductsFormState> {
    if (!user || user.role !== 'admin') {
        return {
            message: 'No tienes permiso para realizar actualizaciones masivas de productos.',
            success: false,
            count: 0
        };
    }

    const validatedProducts = z.array(UpdateProductSchema).safeParse(products);

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
        const updates = [];
        for (const p of validatedProducts.data) {
            let productId: string | null = null;
            let isVariantUpdate = false;
            let variantIndex = -1;

            // First, try to find a product with the exact SKU (simple product or parent)
            const productQuery = query(collection(db, 'products'), where('sku', '==', p.sku));
            let productSnapshot = await getDocs(productQuery);

            if (productSnapshot.empty) {
                // If not found, search for products that have variants with this SKU
                const allProductsQuery = query(collection(db, 'products'));
                const allProductsSnapshot = await getDocs(allProductsQuery);

                for (const doc of allProductsSnapshot.docs) {
                    const productData = doc.data() as Product;
                    if (productData.variants) {
                        const variantIdx = productData.variants.findIndex(v => v.sku === p.sku);
                        if (variantIdx !== -1) {
                            productId = doc.id;
                            isVariantUpdate = true;
                            variantIndex = variantIdx;
                            break;
                        }
                    }
                }

                if (!productId) {
                    return {
                        message: `Producto o variante con SKU ${p.sku} no encontrado.`,
                        success: false,
                        count: 0
                    };
                }
            } else {
                productId = productSnapshot.docs[0].id;
            }

            // Get the product document
            const productDoc = await getDoc(doc(db, 'products', productId));
            if (!productDoc.exists()) {
                return {
                    message: `Producto con ID ${productId} no encontrado.`,
                    success: false,
                    count: 0
                };
            }

            const productData = productDoc.data() as Product;

            if (isVariantUpdate) {
                // Update specific variant
                if (!productData.variants || variantIndex === -1) {
                    return {
                        message: `Variante con SKU ${p.sku} no encontrada en el producto.`,
                        success: false,
                        count: 0
                    };
                }

                const updatedVariants = [...productData.variants];
                const variantUpdate: Partial<ProductVariant> = {};

                if (p.variantname !== undefined) variantUpdate.name = p.variantname;
                if (p.variantpricedropshipping !== undefined) variantUpdate.priceDropshipping = p.variantpricedropshipping;
                if (p.variantpricewholesale !== undefined) variantUpdate.priceWholesale = p.variantpricewholesale;
                if (p.variantcost !== undefined) variantUpdate.cost = p.variantcost;
                if (p.variantpriceminsale !== undefined) variantUpdate.priceMinSale = p.variantpriceminsale;
                if (p.variantpriceoptimalsale !== undefined) variantUpdate.priceOptimalSale = p.variantpriceoptimalsale;
                if (p.variantstock !== undefined) variantUpdate.stock = p.variantstock;

                updatedVariants[variantIndex] = { ...updatedVariants[variantIndex], ...variantUpdate };

                updates.push(updateProduct(productId, { variants: updatedVariants }));
            } else {
                // Update parent product
                const updateData: Partial<Product> = {};
                if (p.name !== undefined) updateData.name = p.name;
                if (p.description !== undefined) updateData.description = p.description;
                if (p.pricedropshipping !== undefined) updateData.priceDropshipping = p.pricedropshipping;
                if (p.pricewholesale !== undefined) updateData.priceWholesale = p.pricewholesale;
                if (p.cost !== undefined && p.cost !== null) updateData.cost = p.cost;
                if (p.priceminsale !== undefined && p.priceminsale !== null) updateData.priceMinSale = p.priceminsale;
                if (p.priceoptimalsale !== undefined && p.priceoptimalsale !== null) updateData.priceOptimalSale = p.priceoptimalsale;
                if (p.stock !== undefined) updateData.stock = p.stock;
                if (p.categoryid !== undefined) updateData.categoryId = p.categoryid;
                if (p.vendorid !== undefined) updateData.vendorId = p.vendorid;
                if (p.warehouseid !== undefined) updateData.warehouseId = p.warehouseid;
                if (p.purchasedate !== undefined && p.purchasedate !== null) updateData.purchaseDate = p.purchasedate.toISOString();
                if (p.codigoerp !== undefined) updateData.codigoERP = p.codigoerp;

                // Keep existing pendingStock and damagedStock
                updateData.pendingStock = productData.pendingStock || 0;
                updateData.damagedStock = productData.damagedStock || 0;

                updates.push(updateProduct(productId, updateData));
            }
        }

        await Promise.all(updates);
        revalidatePath('/products');

        return {
            message: 'Productos y variantes actualizados exitosamente.',
            success: true,
            count: updates.length
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
