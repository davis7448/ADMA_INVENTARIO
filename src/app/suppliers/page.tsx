
import { getSuppliers } from '@/lib/api';
import type { Supplier } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { SuppliersContent } from '@/components/suppliers-content';


export default function SuppliersPage() {
    const suppliers: Supplier[] = await getSuppliers();

    return (
        <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
            <SuppliersContent initialSuppliers={suppliers} />
        </AuthProviderWrapper>
    )
}
