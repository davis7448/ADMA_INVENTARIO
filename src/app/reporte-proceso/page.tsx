import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { ReporteProcesoContent } from '@/components/reporte-proceso-content';

export const dynamic = 'force-dynamic';

export default function ReporteProcesoPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'coordinacion', 'commercial_director', 'plataformas', 'marketing', 'consulta']}>
                <ReporteProcesoContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}
