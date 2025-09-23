

import { getPendingInventory, getProducts } from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { PendingInventoryContent } from '@/components/pending-inventory-content';

export default async function PendingInventoryPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {
    const warehouseId = searchParams?.warehouse as string;
    const [pendingItems, productsResult] = await Promise.all([
        getPendingInventory(warehouseId),
        getProducts({ filters: { warehouseId } })
    ]);

    return (
      <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas', 'commercial']}>
        <PendingInventoryContent initialPendingItems={pendingItems} allProducts={productsResult.products} />
      </AuthProviderWrapper>
    );
}

