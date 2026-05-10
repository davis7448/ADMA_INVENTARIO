import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';
import { ModificacionesContent } from '@/components/modificaciones-content';
import type { UserRole } from '@/lib/types';

export const revalidate = 0;

const ALLOWED_ROLES: UserRole[] = ['admin', 'logistics', 'commercial', 'consulta', 'plataformas'];

export default function ModificacionesPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={ALLOWED_ROLES}>
                <ModificacionesContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}