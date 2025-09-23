"use client";

import AppHeader from '@/components/header';
import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const pathname = usePathname();

    const isLoginPage = pathname === '/login';

    if (isLoginPage) {
        return <>{children}</>;
    }
    
    return (
        <div className="flex flex-col flex-1">
            <AppHeader />
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}