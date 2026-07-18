import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { PurchaseOrdersContent } from '@/components/purchase-orders-content';
import { getSuppliers, getWarehouses } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ComprasPage() {
    const [suppliers, warehouses] = await Promise.all([
        getSuppliers().catch(() => []),
        getWarehouses().catch(() => []),
    ]);

    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'coordinacion', 'marketing', 'plataformas', 'logistics', 'consulta']}>
                <PurchaseOrdersContent suppliers={suppliers} warehouses={warehouses} />
            </AuthProviderWrapper>
        </Suspense>
    );
}
