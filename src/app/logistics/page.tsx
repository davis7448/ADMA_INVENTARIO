
import { getProducts, getCarriers, getPlatforms } from '@/lib/api';
import type { Product, Carrier, Platform } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { LogisticsContent } from '@/components/logistics-content';
import { Suspense } from 'react';

export default async function LogisticsPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {
    
    const warehouseId = searchParams?.warehouse as string | undefined;

    const [productsResult, carriers, platforms] = await Promise.all([
        getProducts({ fetchAll: true, filters: { warehouseId } }),
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
