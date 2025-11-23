import DashboardNewClient from './dashboard-new-client';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';

export default function NewDashboardPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'commercial', 'plataformas']}>
                <DashboardNewClient />
            </AuthProviderWrapper>
        </Suspense>
    );
}