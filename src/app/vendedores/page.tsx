
import { getVendedores } from '@/lib/api';
import type { Vendedor } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { VendedoresContent } from '@/components/vendedores-content';
import { Suspense } from 'react';

export default async function VendedoresPage() {
    let vendedores: Vendedor[] = [];
    try {
        vendedores = await getVendedores();
    } catch (error) {
        console.warn('Failed to fetch vendedores during build:', error);
        vendedores = [];
    }

    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
                <VendedoresContent initialVendedores={vendedores} />
            </AuthProviderWrapper>
        </Suspense>
    );
}
