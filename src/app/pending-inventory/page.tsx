
import { getPendingInventory, getProducts } from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { PendingInventoryContent } from '@/components/pending-inventory-content';

export default async function PendingInventoryPage() {
    const [pendingItems, products] = await Promise.all([
        getPendingInventory(),
        getProducts()
    ]);

    return (
      <AuthProviderWrapper allowedRoles={['admin', 'logistics']}>
        <PendingInventoryContent initialPendingItems={pendingItems} allProducts={products} />
      </AuthProviderWrapper>
    );
}
