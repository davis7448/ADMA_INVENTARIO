
import { getPendingDispatchOrders, getProducts, getPlatforms, getCarriers, getPartialDispatchOrders } from '@/lib/api';
import type { DispatchOrder, Product, Platform, Carrier } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { DispatchContent } from '@/components/dispatch-content';

export default async function DispatchPage() {
    const [fetchedPendingOrders, fetchedPartialOrders, fetchedProducts, fetchedPlatforms, fetchedCarriers] = await Promise.all([
        getPendingDispatchOrders(),
        getPartialDispatchOrders(),
        getProducts(),
        getPlatforms(),
        getCarriers(),
    ]);

    const productsById = fetchedProducts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>);

    return (
        <AuthProviderWrapper allowedRoles={['admin', 'logistics']}>
            <DispatchContent
                initialPendingOrders={fetchedPendingOrders}
                initialPartialOrders={fetchedPartialOrders}
                initialProducts={fetchedProducts}
                initialPlatforms={fetchedPlatforms}
                initialCarriers={fetchedCarriers}
                initialProductsById={productsById}
            />
        </AuthProviderWrapper>
    )
}
