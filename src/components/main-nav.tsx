

"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { SheetClose } from './ui/sheet';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
import { Button } from './ui/button';
import { ChevronDown, ChevronRight, Bell } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "@/components/ui/collapsible"
import React, { useEffect, useState } from 'react';
import { getStaleReservationAlerts } from '@/lib/api';
import { Badge } from './ui/badge';

type NavItem = {
    href?: string;
    label: string;
    roles: string[];
    children?: NavItem[];
    badge?: 'stale_alerts';
  };
  
  const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', roles: ['admin', 'logistics', 'commercial', 'plataformas'] },
    { href: '/products', label: 'Inventario', roles: ['admin', 'commercial', 'plataformas', 'logistics'] },
    {
        label: 'Ventas',
        roles: ['admin'],
        children: [
            { href: '/orders', label: 'Órdenes', roles: ['admin'] },
            { href: '/returns', label: 'Garantías', roles: ['admin'] },
        ],
    },
    {
        label: 'Activos',
        roles: ['admin', 'plataformas'],
        children: [
            { href: '/suppliers', label: 'Proveedores', roles: ['admin', 'plataformas'] },
            { href: '/categories', label: 'Categorías', roles: ['admin', 'plataformas'] },
            { href: '/carriers', label: 'Transportadoras', roles: ['admin', 'plataformas'] },
            { href: '/platforms', label: 'Plataformas', roles: ['admin', 'plataformas'] },
            { href: '/vendedores', label: 'Vendedores', roles: ['admin', 'plataformas'] },
            { href: '/normalize-warehouses', label: 'Normalizar Bodegas', roles: ['admin'] },
        ],
    },
    {
        label: 'Logística',
        roles: ['admin', 'logistics', 'plataformas', 'commercial'],
        children: [
            { href: '/logistics', label: 'Picking', roles: ['admin', 'logistics', 'plataformas'] },
            { href: '/dispatch', label: 'Despachos', roles: ['admin', 'logistics', 'plataformas'] },
            { href: '/pending-inventory', label: 'Pendientes', roles: ['admin', 'logistics', 'plataformas', 'commercial'] },
            { href: '/cancellations', label: 'Anulaciones', roles: ['admin', 'commercial', 'logistics'] },
        ],
    },
    { href: '/history', label: 'Historial', roles: ['admin', 'logistics', 'plataformas'] },
    {
        label: 'Alertas',
        roles: ['admin', 'logistics', 'commercial', 'plataformas'],
        children: [
            { href: '/audit-alerts', label: 'Auditoría', roles: ['admin', 'plataformas'] },
            { href: '/stale-reservations', label: 'Alertas de Reservas', roles: ['admin', 'plataformas'], badge: 'stale_alerts' },
            { href: '/stock-alerts', label: 'Stock', roles: ['admin', 'commercial', 'logistics', 'plataformas'] },
            { href: '/returns-damages', label: 'Devoluciones y Averías', roles: ['admin', 'logistics', 'commercial'] },
        ]
    }
  ];

export default function MainNav({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [staleAlertsCount, setStaleAlertsCount] = useState(0);

  useEffect(() => {
    async function fetchAlerts() {
        if (user?.role === 'admin' || user?.role === 'plataformas') {
            const alerts = await getStaleReservationAlerts();
            setStaleAlertsCount(alerts.length);
        }
    }
    fetchAlerts();
  }, [user, pathname]); // Re-check on path change too

  const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  const linkClass = (href?: string) => cn(
    "font-medium transition-colors",
    isMobile 
      ? "text-lg p-2 rounded-md block w-full text-left hover:bg-black hover:text-primary" 
      : "text-sm hover:text-black dark:hover:text-white",
    pathname === href 
      ? (isMobile ? "text-primary bg-black" : "text-black dark:text-white")
      : "text-muted-foreground"
  );

  const renderBadge = (badgeType?: 'stale_alerts') => {
    if (badgeType === 'stale_alerts' && staleAlertsCount > 0) {
        return <Badge variant="destructive" className="ml-2">{staleAlertsCount}</Badge>;
    }
    return null;
  }

  const renderNavItem = (item: NavItem) => {
    if (item.children) {
      const filteredChildren = item.children.filter(child => user && child.roles.includes(user.role));
      if (filteredChildren.length === 0) return null;

      if (isMobile) {
        return (
            <Collapsible key={item.label} className="w-full">
                <CollapsibleTrigger asChild>
                    <div className={cn(linkClass(), "flex justify-between items-center cursor-pointer")}>
                        {item.label}
                        <ChevronRight className="h-4 w-4 transition-transform [&[data-state=open]]:rotate-90" />
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-4">
                    {filteredChildren.map(renderNavItem)}
                </CollapsibleContent>
            </Collapsible>
        )
      }

      return (
        <DropdownMenu key={item.label}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={cn(linkClass(), "flex items-center gap-1 hover:bg-black hover:text-primary")}>
                {item.label}
                <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {filteredChildren.map(child => (
              <DropdownMenuItem key={child.href} asChild>
                 <Link href={child.href!} className="flex items-center">
                    {child.label}
                    {renderBadge(child.badge)}
                 </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    
    const NavLink = (
      <Link
        href={item.href!}
        className={cn(linkClass(item.href), "flex items-center")}
      >
        {item.label}
        {renderBadge(item.badge)}
      </Link>
    );

    return isMobile ? (
        <SheetClose asChild key={item.href}>
          {NavLink}
        </SheetClose>
      ) : (
        <React.Fragment key={item.href}>
          {NavLink}
        </React.Fragment>
      );
  };
  
  const navClass = isMobile 
  ? "flex flex-col space-y-2"
  : "hidden md:flex items-center space-x-2 lg:space-x-4 ml-6";

  return (
    <nav className={navClass}>
       {filteredNavItems.map(item => renderNavItem(item))}
    </nav>
  );
}
