import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { ManualGuideContent } from '@/components/manual-guide-content';

export const dynamic = 'force-dynamic';

export default function ManualGuidePage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'commercial', 'commercial_director', 'consulta', 'plataformas', 'mercado_libre', 'coordinacion', 'marketing']}>
                <ManualGuideContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}
