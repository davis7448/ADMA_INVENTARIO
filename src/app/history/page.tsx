
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
  User,
} from '@/lib/types';
import { HistoryContent } from '@/components/history-content';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';
import { getUsers } from '@/lib/api';
import { redirect } from 'next/navigation';

async function getCurrentUser(sessionCookie?: string): Promise<User | null> {
    if (!sessionCookie) return null;
    try {
        const app = await getApp();
        const decodedClaims = await getAuth(app).verifySessionCookie(sessionCookie, true);
        const users = await getUsers();
        return users.find(u => u.email === decodedClaims.email) || null;
    } catch (error) {
        console.error("Session verification failed, this is expected if FIREBASE_PRIVATE_KEY is not set.", error);
        return null;
    }
}

export const revalidate = 0;

export default async function HistoryPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  const user = await getCurrentUser(sessionCookie);
  const effectiveWarehouseId = user && user.role !== 'admin' ? (user.warehouseId || 'wh-bog') : undefined;

  // Server-side redirect for logistics users
  if (user?.role === 'logistics' && !searchParams?.warehouse) {
      redirect(`?warehouse=${effectiveWarehouseId}`);
  }

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
    warehouseId: searchParams?.warehouse as string || effectiveWarehouseId,
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
    getProducts({ fetchAll: true, filters: { warehouseId: filters.warehouseId } }), // Fetch all for filter dropdowns
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
