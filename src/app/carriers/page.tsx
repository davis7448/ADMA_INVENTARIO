
import { getCarriers } from '@/lib/api';
import type { Carrier } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { CarriersContent } from '@/components/carriers-content';

export default async function CarriersPage() {
    const carriers: Carrier[] = await getCarriers();

    return (
      <AuthProviderWrapper allowedRoles={['admin']}>
        <CarriersContent initialCarriers={carriers} />
      </AuthProviderWrapper>
    );
}
