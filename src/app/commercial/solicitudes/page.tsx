import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { SolicitudesContent } from '@/components/commercial/solicitudes-content';
import { getPlatforms, getWarehouses } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function SolicitudesPage() {
    const [platforms, warehouses] = await Promise.all([
        getPlatforms().catch(() => []),
        getWarehouses().catch(() => []),
    ]);

    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'commercial', 'commercial_director', 'plataformas', 'coordinacion']}>
                <SolicitudesContent platforms={platforms} warehouses={warehouses} />
            </AuthProviderWrapper>
        </Suspense>
    );
}
