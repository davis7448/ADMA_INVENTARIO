import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { ActividadContent } from '@/components/commercial/actividad-content';

export const dynamic = 'force-dynamic';

// El rol `commercial` entra, pero el componente le fija el filtro a su propia actividad:
// es una herramienta de supervisión, no de comparación entre compañeros.
export default function ActividadComercialPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'commercial_director', 'commercial']}>
                <ActividadContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}
