import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { PurchaseOrderDetailContent } from '@/components/purchase-order-detail-content';
import { getSuppliers, getWarehouses } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderDetailPage({ params }: { params: { id: string } }) {
    const [suppliers, warehouses] = await Promise.all([
        getSuppliers().catch(() => []),
        getWarehouses().catch(() => []),
    ]);

    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'coordinacion', 'marketing', 'plataformas', 'logistics', 'consulta']}>
                <PurchaseOrderDetailContent orderId={params.id} suppliers={suppliers} warehouses={warehouses} />
            </AuthProviderWrapper>
        </Suspense>
    );
}
