"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Users,
    ShoppingBag,
    Trophy,
    Star,
    GraduationCap,
    TrendingUp
} from 'lucide-react';

const sidebarItems = [
    { href: '/commercial/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/commercial/crm/dashboard', label: 'CRM / Clientes', icon: Users },
    { href: '/commercial/catalog', label: 'Catálogo', icon: ShoppingBag },
    { href: '/commercial/challenges', label: 'Retos y Misiones', icon: Trophy },
    { href: '/commercial/tareas', label: 'Tareas', icon: Star },
    { href: '/commercial/academy', label: 'Academia', icon: GraduationCap },
];

export function CommercialSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 hidden lg:flex flex-col border-r bg-card/50 backdrop-blur-sm h-[calc(100vh-4rem)] sticky top-16">
            <div className="p-6">
                <h2 className="text-sm uppercase tracking-wider text-muted-foreground font-bold mb-4">
                    Comercial
                </h2>
                <nav className="space-y-2">
                    {sidebarItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium",
                                    isActive
                                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="mt-auto p-6 border-t">
                <div className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5" />
                        <span className="font-bold text-sm">Meta del Mes</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2 mb-1">
                        <div className="bg-white rounded-full h-2 w-[70%]"></div>
                    </div>
                    <span className="text-xs text-white/90">70% Completado</span>
                </div>
            </div>
        </aside>
    );
}
