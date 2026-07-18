import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { ReceptionsContent } from '@/components/receptions-content';

export const dynamic = 'force-dynamic';

export default function RecepcionesPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'coordinacion', 'plataformas', 'consulta']}>
                <ReceptionsContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}
