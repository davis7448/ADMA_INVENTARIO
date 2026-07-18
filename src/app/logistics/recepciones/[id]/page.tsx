import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { ReceptionDetailContent } from '@/components/reception-detail-content';
import { getCategories, getLocations, getSuppliers } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ReceptionDetailPage({ params }: { params: { id: string } }) {
    const [categories, suppliers, locations] = await Promise.all([
        getCategories().catch(() => []),
        getSuppliers().catch(() => []),
        getLocations().catch(() => []),
    ]);

    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'coordinacion', 'plataformas', 'consulta']}>
                <ReceptionDetailContent receptionId={params.id} categories={categories} suppliers={suppliers} locations={locations} />
            </AuthProviderWrapper>
        </Suspense>
    );
}
