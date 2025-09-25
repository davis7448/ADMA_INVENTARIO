

import { getPendingInventory, getProducts } from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { PendingInventoryContent } from '@/components/pending-inventory-content';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';
import { getUsers } from '@/lib/api';
import type { User } from '@/lib/types';

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

export default async function PendingInventoryPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    const user = await getCurrentUser(sessionCookie);
    const effectiveWarehouseId = user && user.role !== 'admin' ? user.warehouseId : undefined;
    const warehouseId = searchParams?.warehouse as string | undefined || effectiveWarehouseId;
    const [pendingItems, productsResult] = await Promise.all([
        getPendingInventory(warehouseId),
        getProducts({ filters: { warehouseId } })
    ]);

    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas', 'commercial']}>
                <PendingInventoryContent initialPendingItems={pendingItems} allProducts={productsResult.products} />
            </AuthProviderWrapper>
        </Suspense>
    );
}

