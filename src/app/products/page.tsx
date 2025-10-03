

import { getProducts, getSuppliersByIds, getCategoriesByIds, getInventoryMovements, getRotationCategories, getUsers, getLocations } from '@/lib/api';
import type { Product, InventoryMovement, RotationCategory, User, Location } from '@/lib/types';
import { ProductsContent } from '@/components/products-content';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const revalidate = 0;

async function getCurrentUser(sessionCookie?: string): Promise<User | null> {
    if (!sessionCookie) {
        console.log('No session cookie');
        return null;
    }
    try {
        const app = await getApp();
        const decodedClaims = await getAuth(app).verifySessionCookie(sessionCookie, true);
        const users = await getUsers();
        return users.find(u => u.email === decodedClaims.email) || null;
    } catch (error) {
        console.error("Session verification failed:", error);
        return null;
    }
}


export default async function ProductsPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {

    const page = Number(searchParams?.page || '1');
    const limit = Number(searchParams?.limit || '20');
    
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    const user = await getCurrentUser(sessionCookie);
    const effectiveWarehouseId = user && user.role !== 'admin' ? (user.warehouseId || 'wh-bog') : undefined;
    const warehouseId = searchParams?.warehouse as string | undefined || effectiveWarehouseId;

    // Server-side redirect for logistics users
    if (user?.role === 'logistics' && !searchParams?.warehouse) {
        redirect(`?warehouse=${warehouseId}`);
    }

    const filters = {
        searchQuery: searchParams?.q as string,
        selectedCategory: searchParams?.category as string,
        selectedRotation: searchParams?.rotation as string,
        selectedVendedor: searchParams?.vendedor as string,
        minStock: searchParams?.minStock as string,
        hasPending: searchParams?.pending === 'true',
        hasReservations: searchParams?.reservations === 'true',
        onlyAudited: searchParams?.audited === 'true',
        onlyVariable: searchParams?.variable === 'true',
        noWarehouse: searchParams?.noWarehouse === 'true',
        warehouseId: warehouseId,
        userRole: user?.role,
    };

    const [productsResult, rotationCategories, locations] = await Promise.all([
        getProducts({ page, limit, filters }),
        getRotationCategories(),
        getLocations(),
    ]);

    const productIdsOnPage = productsResult.products.map(p => p.id);
    const movementsResult = productIdsOnPage.length > 0 
        ? await getInventoryMovements({ 
            fetchAll: true, 
            filters: { 
                productIds: productIdsOnPage,
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
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
            allLocations={locations}
          />
        </AuthProviderWrapper>
      </Suspense>
    );
}
