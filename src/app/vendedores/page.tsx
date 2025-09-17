
import { getVendedores } from '@/lib/api';
import type { Vendedor } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { VendedoresContent } from '@/components/vendedores-content';

export default async function VendedoresPage() {
    const vendedores: Vendedor[] = await getVendedores();

    return (
      <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
        <VendedoresContent initialVendedores={vendedores} />
      </AuthProviderWrapper>
    );
}
