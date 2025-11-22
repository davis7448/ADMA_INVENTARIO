
import { getSuppliers } from '@/lib/api';
import type { Supplier } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { SuppliersContent } from '@/components/suppliers-content';
import { Suspense } from 'react';


export default async function SuppliersPage() {
    let suppliers: Supplier[] = [];
    try {
        suppliers = await getSuppliers();
    } catch (error) {
        console.warn('Failed to fetch suppliers during build:', error);
        suppliers = [];
    }

    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
                <SuppliersContent initialSuppliers={suppliers} />
            </AuthProviderWrapper>
        </Suspense>
    )
}
