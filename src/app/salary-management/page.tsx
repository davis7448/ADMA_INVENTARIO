"use client";

import { useState, useEffect } from 'react';
import { getUsers } from '@/lib/api';
import type { User } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';
import { SalaryManagement } from '@/components/salary-management';
import { Skeleton } from '@/components/ui/skeleton';

function SalaryManagementContent() {
    const [comerciales, setComerciales] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        try {
            const allUsers = await getUsers();
            const filtered = allUsers.filter(u => u.role === 'commercial');
            setComerciales(filtered);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Gestión de Salarios</h1>
                <p className="text-muted-foreground">Configura los salarios de los usuarios comerciales.</p>
            </div>
            <SalaryManagement
                comerciales={comerciales}
                loading={loading}
                onUsersUpdate={fetchUsers}
            />
        </div>
    );
}

export default function SalaryManagementPage() {
    return (
        <Suspense fallback={
            <div className="space-y-6">
                <div>
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-5 w-96 mt-2" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        }>
            <AuthProviderWrapper allowedRoles={['admin']}>
                <SalaryManagementContent />
            </AuthProviderWrapper>
        </Suspense>
    );
}