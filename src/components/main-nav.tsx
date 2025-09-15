
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
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "@/components/ui/collapsible"
import React from 'react';

type NavItem = {
    href?: string;
    label: string;
    roles: string[];
    children?: NavItem[];
  };
  
  const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', roles: ['admin', 'logistics', 'commercial'] },
    { href: '/products', label: 'Products', roles: ['admin', 'commercial'] },
    {
        label: 'Activos',
        roles: ['admin', 'commercial'],
        children: [
            { href: '/suppliers', label: 'Suppliers', roles: ['admin', 'commercial'] },
            { href: '/categories', label: 'Categories', roles: ['admin', 'commercial'] },
            { href: '/carriers', label: 'Carriers', roles: ['admin', 'commercial'] },
            { href: '/platforms', label: 'Platforms', roles: ['admin', 'commercial'] },
        ],
    },
    { href: '/logistics', label: 'Logística', roles: ['admin', 'logistics'] },
    { href: '/history', label: 'Historial', roles: ['admin', 'logistics'] },
  ];

export default function MainNav({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  const linkClass = (href?: string) => cn(
    "font-medium transition-colors hover:text-primary",
    isMobile 
      ? "text-lg p-2 rounded-md block w-full text-left" 
      : "text-sm",
    pathname === href 
      ? (isMobile ? "text-primary bg-muted" : "text-primary")
      : "text-muted-foreground"
  );

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
            <Button variant="ghost" className={cn(linkClass(), "flex items-center gap-1")}>
                {item.label}
                <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {filteredChildren.map(child => (
              <DropdownMenuItem key={child.href} asChild>
                 <Link href={child.href!}>{child.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    
    const NavLink = (
      <Link
        href={item.href!}
        className={linkClass(item.href)}
      >
        {item.label}
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
