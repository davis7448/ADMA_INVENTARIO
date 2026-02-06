
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

export const revalidate = 3600; // Cache for 1 hour since platforms and carriers rarely change

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
  const itemsPerPage = Number(searchParams?.limit || '5'); // Reduced from 10 to 5 to prevent connection issues

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


  // Fetch data SEQUENTIALLY to prevent Firebase connection issues
  // Promise.all creates too many simultaneous connections
  let movementsResult = { movements: [] as InventoryMovement[], totalPages: 0, totalCount: 0 };
  let ordersResult = { orders: [] as DispatchOrder[], totalPages: 0, totalCount: 0 };
  let allPlatforms: Platform[] = [];
  let allCarriers: Carrier[] = [];

  try {
    // 1. First fetch static data (platforms and carriers) - these are cached
    allPlatforms = await getPlatforms();
    allCarriers = await getCarriers();
    
    // 2. Then fetch dynamic data one by one
    movementsResult = await getInventoryMovements({ page: movementsPage, limit: itemsPerPage, filters });
    ordersResult = await getDispatchOrders({ page: ordersPage, limit: itemsPerPage, filters });
  } catch (error) {
    console.error("Error fetching history data:", error);
    // Return empty data - page will show "no data" state
  }

  // Extract unique product IDs from movements (max 50 for performance)
  const uniqueProductIds = Array.from(new Set(
    movementsResult.movements.map(m => m.productId)
  )).slice(0, 50);

  // Fetch only the products that appear in the movements
  let relatedProducts: Product[] = [];
  if (uniqueProductIds.length > 0) {
    try {
      const productsResult = await getProducts({ 
        fetchAll: true, 
        filters: { ids: uniqueProductIds } 
      });
      relatedProducts = productsResult.products;
    } catch (error) {
      console.error("Error fetching related products:", error);
      // Continue with empty products array - page will still work
    }
  }

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
