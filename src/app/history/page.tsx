
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
    console.log('[DEBUG] HistoryPage - getCurrentUser called');
    if (!sessionCookie) {
        console.log('[DEBUG] HistoryPage - No session cookie');
        return null;
    }
    try {
        console.log('[DEBUG] HistoryPage - Verifying session...');
        const app = await getApp();
        const decodedClaims = await getAuth(app).verifySessionCookie(sessionCookie, true);
        const users = await getUsers();
        const user = users.find(u => u.email === decodedClaims.email) || null;
        console.log('[DEBUG] HistoryPage - User found:', user?.email);
        return user;
    } catch (error) {
        console.error("[DEBUG] HistoryPage - Session verification failed:", error);
        return null;
    }
}

export const revalidate = 3600;

export default async function HistoryPage({
    searchParams
  }: {
    searchParams: { [key: string]: string | string[] | undefined }
  }) {

  console.log('[DEBUG] HistoryPage - START');
  console.log('[DEBUG] HistoryPage - searchParams:', JSON.stringify(searchParams));

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  console.log('[DEBUG] HistoryPage - Session cookie exists:', !!sessionCookie);

  const user = await getCurrentUser(sessionCookie);
  const effectiveWarehouseId = user && user.role !== 'admin' ? (user.warehouseId || 'wh-bog') : undefined;
  console.log('[DEBUG] HistoryPage - effectiveWarehouseId:', effectiveWarehouseId);

  // Server-side redirect for logistics users
  if (user?.role === 'logistics' && !searchParams?.warehouse) {
      console.log('[DEBUG] HistoryPage - Redirecting logistics user');
      redirect(`?warehouse=${effectiveWarehouseId}`);
  }

  const movementsPage = Number(searchParams?.movementsPage || '1');
  const ordersPage = Number(searchParams?.ordersPage || '1');
  const itemsPerPage = Number(searchParams?.limit || '5');
  console.log('[DEBUG] HistoryPage - Pagination:', { movementsPage, ordersPage, itemsPerPage });

  const filters = {
    productId: searchParams?.productId as string || 'all',
    platformId: searchParams?.platformId as string || 'all',
    carrierId: searchParams?.carrierId as string || 'all',
    movementType: searchParams?.movementType as string || 'all',
    startDate: searchParams?.startDate as string,
    endDate: searchParams?.endDate as string,
    warehouseId: searchParams?.warehouse as string || effectiveWarehouseId,
    productSearch: searchParams?.productSearch as string,
  };
  console.log('[DEBUG] HistoryPage - Filters:', JSON.stringify(filters));

  let movementsResult = { movements: [] as InventoryMovement[], totalPages: 0, totalCount: 0 };
  let ordersResult = { orders: [] as DispatchOrder[], totalPages: 0, totalCount: 0 };
  let allPlatforms: Platform[] = [];
  let allCarriers: Carrier[] = [];

  try {
    console.log('[DEBUG] HistoryPage - Fetching platforms...');
    allPlatforms = await getPlatforms();
    console.log('[DEBUG] HistoryPage - Platforms fetched:', allPlatforms.length);
    
    console.log('[DEBUG] HistoryPage - Fetching carriers...');
    allCarriers = await getCarriers();
    console.log('[DEBUG] HistoryPage - Carriers fetched:', allCarriers.length);
    
    console.log('[DEBUG] HistoryPage - Fetching movements...');
    movementsResult = await getInventoryMovements({ page: movementsPage, limit: itemsPerPage, filters });
    console.log('[DEBUG] HistoryPage - Movements fetched:', movementsResult.movements.length);
    
    console.log('[DEBUG] HistoryPage - Fetching orders...');
    ordersResult = await getDispatchOrders({ page: ordersPage, limit: itemsPerPage, filters });
    console.log('[DEBUG] HistoryPage - Orders fetched:', ordersResult.orders.length);
  } catch (error) {
    console.error('[DEBUG] HistoryPage - ERROR fetching data:', error);
    console.error('[DEBUG] HistoryPage - Error stack:', (error as Error).stack);
  }

  console.log('[DEBUG] HistoryPage - Extracting product IDs...');
  const uniqueProductIds = Array.from(new Set(
    movementsResult.movements.map(m => m.productId)
  )).slice(0, 50);
  console.log('[DEBUG] HistoryPage - Unique product IDs:', uniqueProductIds.length);

  let relatedProducts: Product[] = [];
  if (uniqueProductIds.length > 0) {
    try {
      console.log('[DEBUG] HistoryPage - Fetching related products...');
      const productsResult = await getProducts({ 
        fetchAll: true, 
        filters: { ids: uniqueProductIds } 
      });
      relatedProducts = productsResult.products;
      console.log('[DEBUG] HistoryPage - Related products fetched:', relatedProducts.length);
    } catch (error) {
      console.error('[DEBUG] HistoryPage - ERROR fetching related products:', error);
      console.error('[DEBUG] HistoryPage - Error stack:', (error as Error).stack);
    }
  }

  console.log('[DEBUG] HistoryPage - RENDERING with data:', {
    movements: movementsResult.movements.length,
    orders: ordersResult.orders.length,
    platforms: allPlatforms.length,
    carriers: allCarriers.length,
    products: relatedProducts.length
  });

  return (
    <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas']}>
      <HistoryContent
        initialMovements={movementsResult.movements}
        movementsTotalPages={movementsResult.totalPages}
        initialDispatchOrders={ordersResult.orders}
        ordersTotalPages={ordersResult.totalPages}
        allProducts={relatedProducts}
        allPlatforms={allPlatforms}
        allCarriers={allCarriers}
      />
    </AuthProviderWrapper>
  );
}
