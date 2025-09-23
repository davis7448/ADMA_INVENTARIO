
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { DispatchContent } from '@/components/dispatch-content';
import { Suspense } from 'react';
import { getPendingDispatchOrders, getPartialDispatchOrders, getProducts, getPlatforms, getCarriers } from '@/lib/api';

export default async function DispatchPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {

    const warehouseId = searchParams?.warehouse as string | undefined;

    const [fetchedPendingOrders, fetchedPartialOrders, fetchedProductsResult, fetchedPlatforms, fetchedCarriers] = await Promise.all([
        getPendingDispatchOrders(warehouseId),
        getPartialDispatchOrders(warehouseId),
        getProducts({ limit: 10000, filters: { warehouseId } }),
        getPlatforms(),
        getCarriers(),
    ]);

    return (
      <Suspense>
        <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas']}>
            <DispatchContent 
                initialPendingOrders={fetchedPendingOrders}
                initialPartialOrders={fetchedPartialOrders}
                initialProducts={fetchedProductsResult.products}
                initialPlatforms={fetchedPlatforms}
                initialCarriers={fetchedCarriers}
            />
        </AuthProviderWrapper>
      </Suspense>
    )
}
