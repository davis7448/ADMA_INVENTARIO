
import {
  getInventoryMovements,
  getProducts,
  getPlatforms,
  getCarriers,
  getDispatchOrders,
} from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import type {
  InventoryMovement,
  Product,
  Platform,
  Carrier,
  DispatchOrder,
} from '@/lib/types';
import { HistoryContent } from '@/components/history-content';

export const revalidate = 0;

async function HistoryPageContent() {
  const [
    fetchedMovements,
    fetchedDispatchOrders,
    fetchedProducts,
    fetchedPlatforms,
    fetchedCarriers,
  ] = await Promise.all([
    getInventoryMovements(),
    getDispatchOrders(),
    getProducts(),
    getPlatforms(),
    getCarriers(),
  ]);

  return (
    <HistoryContent
      initialMovements={fetchedMovements}
      initialDispatchOrders={fetchedDispatchOrders}
      allProducts={fetchedProducts}
      allPlatforms={fetchedPlatforms}
      allCarriers={fetchedCarriers}
    />
  );
}

export default function HistoryPage() {
  return (
    <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas']}>
      <HistoryPageContent />
    </AuthProviderWrapper>
  );
}
