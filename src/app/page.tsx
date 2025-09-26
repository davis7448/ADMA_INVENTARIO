"use client";

import DashboardClient from './dashboard-client';
import { useAuth } from '@/hooks/use-auth';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();
    const redirectedRef = useRef(false);

    // Auto-redirect logistics users to their warehouse URL
    useEffect(() => {
        if (!authLoading && !redirectedRef.current && user?.role === 'logistics' && !searchParams.get('warehouse')) {
            const warehouse = user.warehouseId || 'wh-bog';
            redirectedRef.current = true;
            router.push(`/?warehouse=${warehouse}`);
        }
    }, [user, authLoading, searchParams, router]);

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div>Cargando dashboard...</div>
            </div>
        );
    }

    return <DashboardClient />;
}
