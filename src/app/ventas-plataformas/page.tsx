import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { VentasPlataformasContent } from '@/components/ventas-plataformas-content';

export const dynamic = 'force-dynamic';

export default function VentasPlataformasPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'coordinacion', 'commercial_director', 'plataformas', 'marketing', 'consulta']}>
                <VentasPlataformasContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}
