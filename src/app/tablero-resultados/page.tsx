import { getUsers } from '@/lib/api';
import type { User } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { TableroResultadosContent } from '@/components/tablero-resultados-content';

export const revalidate = 0;

async function getCurrentUser(sessionCookie?: string): Promise<User | null> {
    if (!sessionCookie) {
        return null;
    }
    try {
        const app = await getApp();
        const decodedClaims = await getAuth(app).verifySessionCookie(sessionCookie, true);
        const users = await getUsers();
        return users.find(u => u.email === decodedClaims.email) || null;
    } catch (error) {
        return null;
    }
}

export default async function TableroResultadosPage() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    const user = await getCurrentUser(sessionCookie);

    const allUsers = await getUsers();
    const comerciales = allUsers.filter(u => u.role === 'commercial');

    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin']}>
                <TableroResultadosContent
                    comerciales={comerciales}
                    currentUser={user}
                />
            </AuthProviderWrapper>
        </Suspense>
    );
}