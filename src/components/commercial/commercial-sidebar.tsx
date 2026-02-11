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
    TrendingUp,
    Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';

const sidebarItems = [
    { href: '/commercial/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/commercial/crm/dashboard', label: 'CRM / Clientes', icon: Users },
    { href: '/commercial/catalog', label: 'Catálogo', icon: ShoppingBag },
    { href: '/commercial/challenges', label: 'Retos y Misiones', icon: Trophy },
    { href: '/commercial/tareas', label: 'Tareas', icon: Star },
    { href: '/commercial/academy', label: 'Academia', icon: GraduationCap },
];

function SidebarContent() {
    const pathname = usePathname();
    
    return (
        <div className="flex flex-col h-full">
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
                                    "flex items-center gap-3 px-3 py-3 rounded-lg transition-all text-base font-medium",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted"
                                )}
                            >
                                <Icon className="h-5 w-5" />
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
        </div>
    );
}

export function CommercialSidebar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Botón de menú para móvil */}
            <div className="lg:hidden fixed bottom-4 right-4 z-50">
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button size="lg" className="rounded-full shadow-lg">
                            <Menu className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80">
                        <SidebarContent />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Sidebar para escritorio */}
            <aside className="w-64 hidden lg:flex flex-col border-r bg-card/50 backdrop-blur-sm h-[calc(100vh-6rem)] sticky top-24">
                <SidebarContent />
            </aside>
        </>
    );
}
