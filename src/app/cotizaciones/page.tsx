import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { CotizacionesContent } from '@/components/cotizaciones/cotizaciones-content';

export const dynamic = 'force-dynamic';

export default function CotizacionesPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'commercial_director', 'commercial', 'coordinacion']}>
                <CotizacionesContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}
