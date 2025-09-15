"use client";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Box,
  ShoppingCart,
  Truck,
  Undo2,
  Wrench,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'logistics', 'commercial'] },
  { href: '/products', label: 'Products', icon: Box, roles: ['admin', 'commercial'] },
  { href: '/orders', label: 'Orders', icon: ShoppingCart, roles: ['admin', 'commercial'] },
  { href: '/suppliers', label: 'Suppliers', icon: Truck, roles: ['admin', 'logistics'] },
  { href: '/returns', label: 'Returns', icon: Undo2, roles: ['admin', 'logistics'] },
  { href: '/restock-alerts', label: 'Restock Alerts', icon: Wrench, roles: ['admin', 'logistics'] },
];

export default function MainNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <SidebarMenu>
      {filteredNavItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.href}
            tooltip={item.label}
          >
            <Link href={item.href}>
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
