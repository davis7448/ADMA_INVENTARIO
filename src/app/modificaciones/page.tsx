import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';
import { ModificacionesContent } from '@/components/modificaciones-content';

export const revalidate = 0;

export default function ModificacionesPage() {
    return (
        <Suspense>
            <ModificacionesContent />
        </Suspense>
    );
}