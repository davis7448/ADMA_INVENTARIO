
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
    productSearch: searchParams?.productSearch as string,
    platformId: searchParams?.platformId as string || 'all',
    carrierId: searchParams?.carrierId as string || 'all',
    movementType: searchParams?.movementType as string || 'all',
    startDate: searchParams?.startDate as string,
    endDate: searchParams?.endDate as string,
    warehouseId: searchParams?.warehouse as string || effectiveWarehouseId,
  };


  // Fetch data with error handling
  let movementsResult = { movements: [] as any[], totalPages: 0, totalCount: 0 };
  let ordersResult = { orders: [] as any[], totalPages: 0, totalCount: 0 };
  let allPlatforms: Platform[] = [];
  let allCarriers: Carrier[] = [];
  
  try {
    [movementsResult, ordersResult, allPlatforms, allCarriers] = await Promise.all([
      getInventoryMovements({ page: movementsPage, limit: itemsPerPage, filters }),
      getDispatchOrders({ page: ordersPage, limit: itemsPerPage, filters }),
      getPlatforms(),
      getCarriers(),
    ]);
  } catch (error) {
    console.error("Error fetching history data:", error);
  }

  // Extract unique product IDs from movements to fetch only necessary products
  const movementProductIds = new Set<string>();
  movementsResult.movements.forEach(m => {
    if (m.productId) movementProductIds.add(m.productId);
  });
  
  // Fetch only products that appear in movements (max 50 for performance)
  let productsForMovements: Product[] = [];
  if (movementProductIds.size > 0) {
    try {
      const productIds = Array.from(movementProductIds).slice(0, 50);
      const productsResult = await getProducts({ 
        limit: 50,
        filters: { 
          ids: productIds,
          warehouseId: filters.warehouseId 
        } 
      });
      productsForMovements = productsResult.products;
    } catch (error) {
      console.error("Error fetching products for history:", error);
    }
  }

  return (
    <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas']}>
      <HistoryContent
        initialMovements={movementsResult.movements}
        movementsTotalPages={movementsResult.totalPages}
        initialDispatchOrders={ordersResult.orders}
        ordersTotalPages={ordersResult.totalPages}
        allProducts={productsForMovements}
        allPlatforms={allPlatforms}
        allCarriers={allCarriers}
      />
    </AuthProviderWrapper>
  );
}
