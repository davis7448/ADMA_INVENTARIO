

import { getProducts, getSuppliersByIds, getCategoriesByIds, getInventoryMovements, getRotationCategories } from '@/lib/api';
import type { Product, InventoryMovement, RotationCategory } from '@/lib/types';
import { ProductsContent } from '@/components/products-content';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';

export const revalidate = 0;

export default async function ProductsPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {

    const page = Number(searchParams?.page || '1');
    const limit = Number(searchParams?.limit || '20');
    
    const filters = {
        searchQuery: searchParams?.q as string,
        selectedCategory: searchParams?.category as string,
        selectedRotation: searchParams?.rotation as string,
        selectedVendedor: searchParams?.vendedor as string,
        minStock: searchParams?.minStock as string,
        hasPending: searchParams?.pending === 'true',
        hasReservations: searchParams?.reservations === 'true',
        onlyAudited: searchParams?.audited === 'true',
        warehouseId: searchParams?.warehouse as string | undefined,
    };

    const [productsResult, rotationCategories] = await Promise.all([
        getProducts({ page, limit, filters }),
        getRotationCategories(),
    ]);

    // Fetch movements only for the products on the current page
    const productIdsOnPage = productsResult.products.map(p => p.id);
    const movementsResult = productIdsOnPage.length > 0 
        ? await getInventoryMovements({ 
            fetchAll: true, 
            filters: { 
                productIds: productIdsOnPage,
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                warehouseId: filters.warehouseId 
            } 
        })
        : { movements: [] };

    const salesByProduct: Record<string, number> = {};
    for (const movement of movementsResult.movements) {
        if (movement.type === 'Salida') {
            salesByProduct[movement.productId] = (salesByProduct[movement.productId] || 0) + movement.quantity;
        }
    }

    const sortedRotationCategories = [...rotationCategories].sort((a,b) => b.salesThreshold - a.salesThreshold);

    const getRotationCategoryName = (productId: string): string => {
        const sales = salesByProduct[productId] || 0;
        for (const category of sortedRotationCategories) {
            if (sales >= category.salesThreshold) {
                return category.name;
            }
        }
        return 'Inactivo';
    }

    const productsWithRotation = productsResult.products.map(product => ({
        ...product,
        rotationCategoryName: getRotationCategoryName(product.id),
    }));

    // Fetch names only for the products on the current page to optimize
    const uniqueVendorIds = [...new Set(productsWithRotation.map(p => p.vendorId).filter(Boolean))];
    const uniqueCategoryIds = [...new Set(productsWithRotation.map(p => p.categoryId).filter(Boolean))];
    
    const [supplierNames, categoryNames] = await Promise.all([
        getSuppliersByIds(uniqueVendorIds as string[]),
        getCategoriesByIds(uniqueCategoryIds as string[]),
    ]);


    return (
      <Suspense>
        <AuthProviderWrapper allowedRoles={['admin', 'commercial', 'plataformas', 'logistics']}>
          <ProductsContent 
            initialProducts={productsWithRotation}
            totalPages={productsResult.totalPages}
            initialSupplierNames={supplierNames}
            initialCategoryNames={categoryNames}
            allRotationCategories={rotationCategories}
          />
        </AuthProviderWrapper>
      </Suspense>
    );
}

