
import { getProducts, getCarriers, getPlatforms, getUsers } from '@/lib/api';
import type { Product, Carrier, Platform, User } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { LogisticsContent } from '@/components/logistics-content';
import { Suspense } from 'react';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

async function getCurrentUser(sessionCookie?: string): Promise<User | null> {
    if (!sessionCookie) {
        return null;
    }
    try {
        const app = await getApp();
        const decodedClaims = await getAuth(app).verifySessionCookie(sessionCookie, true);
        const users = await getUsers();
        return users.find(u => u.email === decodedClaims.email) || null;
    } catch (error) {
        return null;
    }
}

export default async function LogisticsPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    const user = await getCurrentUser(sessionCookie);
    const effectiveWarehouseId = user && user.role !== 'admin' ? (user.warehouseId || 'wh-bog') : undefined;
    const warehouseId = searchParams?.warehouse as string | undefined || effectiveWarehouseId;

    const filters = {
        warehouseId: warehouseId,
        userRole: user?.role,
    };

    const [productsResult, carriers, platforms] = await Promise.all([
        getProducts({ fetchAll: true, filters }),
        getCarriers(),
        getPlatforms(),
    ]);

    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas']}>
                <LogisticsContent 
                    initialProducts={productsResult.products}
                    initialCarriers={carriers}
                    initialPlatforms={platforms}
                />
            </AuthProviderWrapper>
        </Suspense>
    );
}
