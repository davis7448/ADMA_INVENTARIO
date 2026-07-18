import { Suspense } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { LiquidationContent } from '@/components/liquidation-content';

export const dynamic = 'force-dynamic';

export default function LiquidacionPage({ params }: { params: { id: string } }) {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'coordinacion', 'plataformas', 'consulta']}>
                <LiquidationContent orderId={params.id} />
            </AuthProviderWrapper>
        </Suspense>
    );
}
