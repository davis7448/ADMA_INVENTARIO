
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { DispatchContent } from '@/components/dispatch-content';
import { Suspense } from 'react';

export default function DispatchPage() {
    return (
      <Suspense>
        <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas']}>
            <DispatchContent />
        </AuthProviderWrapper>
      </Suspense>
    )
}
