
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

export default async function HistoryPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {

  const movementsPage = Number(searchParams?.movementsPage || '1');
  const ordersPage = Number(searchParams?.ordersPage || '1');
  const itemsPerPage = Number(searchParams?.limit || '10');
  
  const filters = {
    productId: searchParams?.productId as string || 'all',
    platformId: searchParams?.platformId as string || 'all',
    carrierId: searchParams?.carrierId as string || 'all',
    movementType: searchParams?.movementType as string || 'all',
    startDate: searchParams?.startDate as string,
    endDate: searchParams?.endDate as string,
  };


  const [
    movementsResult,
    ordersResult,
    allProducts,
    allPlatforms,
    allCarriers,
  ] = await Promise.all([
    getInventoryMovements({ page: movementsPage, limit: itemsPerPage, filters }),
    getDispatchOrders({ page: ordersPage, limit: itemsPerPage, filters }),
    getProducts({ limit: 10000 }), // Fetch all for filter dropdowns
    getPlatforms(),
    getCarriers(),
  ]);

  return (
    <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas']}>
      <HistoryContent
        initialMovements={movementsResult.movements}
        movementsTotalPages={movementsResult.totalPages}
        initialDispatchOrders={ordersResult.orders}
        ordersTotalPages={ordersResult.totalPages}
        allProducts={allProducts.products}
        allPlatforms={allPlatforms}
        allCarriers={allCarriers}
      />
    </AuthProviderWrapper>
  );
}
