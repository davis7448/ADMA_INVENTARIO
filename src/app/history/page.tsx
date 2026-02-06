import { getPlatforms, getCarriers } from '@/lib/api';
import { HistoryContainer } from './components/HistoryContainer';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';
import { getUsers } from '@/lib/api';
import { redirect } from 'next/navigation';
import type { User } from '@/lib/types';

async function getCurrentUser(sessionCookie?: string): Promise<User | null> {
  if (!sessionCookie) return null;
  try {
    const app = await getApp();
    const decodedClaims = await getAuth(app).verifySessionCookie(sessionCookie, true);
    const users = await getUsers();
    return users.find(u => u.email === decodedClaims.email) || null;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}

export const revalidate = 3600; // Cache platforms and carriers for 1 hour

export default async function HistoryPage({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  const user = await getCurrentUser(sessionCookie);
  const effectiveWarehouseId = user && user.role !== 'admin' 
    ? (user.warehouseId || 'wh-bog') 
    : undefined;

  // Redirect logistics users
  if (user?.role === 'logistics' && !searchParams?.warehouse) {
    redirect(`?warehouse=${effectiveWarehouseId}`);
  }

  // Fetch static data (cached)
  let platforms: any[] = [];
  let carriers: any[] = [];
  
  try {
    [platforms, carriers] = await Promise.all([
      getPlatforms(),
      getCarriers()
    ]);
  } catch (error) {
    console.error('Error fetching platforms/carriers:', error);
  }

  return (
    <AuthProviderWrapper allowedRoles={['admin', 'logistics', 'plataformas']}>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Historial</h1>
          <p className="text-muted-foreground mt-2">
            Consulta el historial de movimientos y órdenes de despacho
          </p>
        </div>
        
        <HistoryContainer 
          initialPlatforms={platforms}
          initialCarriers={carriers}
          warehouseId={effectiveWarehouseId}
        />
      </div>
    </AuthProviderWrapper>
  );
}
