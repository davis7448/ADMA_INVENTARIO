import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { MovimientoContent } from '@/components/movimiento/movimiento-content';

export const dynamic = 'force-dynamic';

export default function MovimientoDiarioPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'commercial_director', 'coordinacion', 'plataformas', 'consulta']}>
                <MovimientoContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}
