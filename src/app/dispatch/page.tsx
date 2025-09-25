
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { DispatchContent } from '@/components/dispatch-content';
import { Suspense } from 'react';
import { getPendingDispatchOrders, getPartialDispatchOrders, getProducts, getPlatforms, getCarriers } from '@/lib/api';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';
import { getUsers } from '@/lib/api';
import type { User } from '@/lib/types';
import { redirect } from 'next/navigation';

async function getCurrentUser(sessionCookie?: string): Promise<User | null> {
    if (!sessionCookie) return null;
    try {
        const app = await getApp();
        const decodedClaims = await getAuth(app).verifySessionCookie(sessionCookie, true);
        const users = await getUsers();
        return users.find(u => u.email === decodedClaims.email) || null;
    } catch (error) {
        console.error("Session verification failed, this is expected if FIREBASE_PRIVATE_KEY is not set.", error);
        return null;
    }
}

export default async function DispatchPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    const user = await getCurrentUser(sessionCookie);
    const effectiveWarehouseId = user && user.role !== 'admin' ? (user.warehouseId || 'wh-bog') : undefined;
    const warehouseId = searchParams?.warehouse as string | undefined || effectiveWarehouseId;

    // Server-side redirect for logistics users
    if (user?.role === 'logistics' && !searchParams?.warehouse) {
        redirect(`?warehouse=${warehouseId}`);
    }

    const [fetchedPendingOrders, fetchedPartialOrders, fetchedProductsResult, fetchedPlatforms, fetchedCarriers] = await Promise.all([
        getPendingDispatchOrders(warehouseId),
        getPartialDispatchOrders(warehouseId),
        getProducts({ limit: 10000, filters: { warehouseId: warehouseId === 'wh-bog' ? undefined : warehouseId } }),
        getPlatforms(),
        getCarriers(),
    ]);

    // For logistics in wh-bog, filter products to only show wh-bog or null in the list, but keep all for product lookup in orders
    let initialAllProducts = fetchedProductsResult.products;
    if (warehouseId === 'wh-bog') {
        fetchedProductsResult.products = initialAllProducts.filter(p => p.warehouseId === 'wh-bog' || p.warehouseId == null);
    }

    return (
      <Suspense>
        <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas']}>
            <DispatchContent
                initialPendingOrders={fetchedPendingOrders}
                initialPartialOrders={fetchedPartialOrders}
                initialProducts={fetchedProductsResult.products}
                initialAllProducts={initialAllProducts}
                initialPlatforms={fetchedPlatforms}
                initialCarriers={fetchedCarriers}
            />
        </AuthProviderWrapper>
      </Suspense>
    )
}
