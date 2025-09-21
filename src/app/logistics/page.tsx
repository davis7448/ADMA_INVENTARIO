
import { getProducts, getCarriers, getPlatforms } from '@/lib/api';
import type { Product, Carrier, Platform } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { LogisticsContent } from '@/components/logistics-content';

export default async function LogisticsPage() {
    const [productsResult, carriers, platforms] = await Promise.all([
        getProducts({}),
        getCarriers(),
        getPlatforms(),
    ]);

    return (
        <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas']}>
            <LogisticsContent 
                initialProducts={productsResult.products}
                initialCarriers={carriers}
                initialPlatforms={platforms}
            />
        </AuthProviderWrapper>
    );
}
