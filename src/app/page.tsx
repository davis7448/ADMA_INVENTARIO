import DashboardNewClient from './dashboard-client';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';

export default function DashboardPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'commercial', 'plataformas', 'mercado_libre']}>
                <DashboardNewClient />
            </AuthProviderWrapper>
        </Suspense>
    );
}
