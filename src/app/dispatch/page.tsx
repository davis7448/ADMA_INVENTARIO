
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { DispatchContent } from '@/components/dispatch-content';

export default function DispatchPage() {
    return (
        <AuthProviderWrapper allowedRoles={['admin', 'logistics']}>
            <DispatchContent />
        </AuthProviderWrapper>
    )
}
