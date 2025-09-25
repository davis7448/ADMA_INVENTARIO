import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';
import { getUsers } from '@/lib/api';
import type { User } from '@/lib/types';
import { redirect } from 'next/navigation';
import DashboardClient from './dashboard-client';

async function getCurrentUser(sessionCookie?: string): Promise<User | null> {
    if (!sessionCookie) return null;
    try {
        const app = await getApp();
        const decodedClaims = await getAuth(app).verifySessionCookie(sessionCookie, true);
        const users = await getUsers();
        return users.find(u => u.email === decodedClaims.email) || null;
    } catch (error) {
        return null;
    }
}

export default async function DashboardPage({
    searchParams
}: {
    searchParams: { [key: string]: string | string[] | undefined }
}) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    const user = await getCurrentUser(sessionCookie);

    // Server-side redirect for logistics users
    if (user?.role === 'logistics' && !searchParams?.warehouse) {
        const warehouse = user.warehouseId || 'wh-bog';
        redirect(`/?warehouse=${warehouse}`);
    }

    return (
        <Suspense>
            <DashboardClient />
        </Suspense>
    );
}
