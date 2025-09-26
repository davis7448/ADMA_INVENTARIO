import DashboardClient from './dashboard-client';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';

export default function DashboardPage() {
    return (
        <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas', 'commercial']}>
            <DashboardClient />
        </AuthProviderWrapper>
    );
}
