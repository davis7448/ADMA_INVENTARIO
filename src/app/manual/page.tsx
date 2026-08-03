import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { ManualListContent } from '@/components/manual-list-content';

export const dynamic = 'force-dynamic';

// El manual lo puede ver cualquier usuario autenticado.
export default function ManualPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'commercial', 'commercial_director', 'consulta', 'plataformas', 'mercado_libre', 'coordinacion', 'marketing']}>
                <ManualListContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}
