import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { DifusionContent } from '@/components/commercial/difusion-content';

export const dynamic = 'force-dynamic';

export default function DifusionPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'commercial', 'commercial_director', 'coordinacion', 'marketing']}>
                <DifusionContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}
