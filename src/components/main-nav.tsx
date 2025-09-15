
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { SheetClose } from './ui/sheet';

const navItems = [
  { href: '/', label: 'Dashboard', roles: ['admin', 'logistics', 'commercial'] },
  { href: '/products', label: 'Products', roles: ['admin', 'commercial'] },
  { href: '/suppliers', label: 'Suppliers', roles: ['admin', 'commercial'] },
  { href: '/categories', label: 'Categories', roles: ['admin', 'commercial'] },
  { href: '/logistics', label: 'Logística', roles: ['admin', 'logistics'] },
  { href: '/history', label: 'Historial', roles: ['admin', 'logistics'] },
];

export default function MainNav({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  const navClass = isMobile 
    ? "flex flex-col space-y-2"
    : "hidden md:flex items-center space-x-4 lg:space-x-6 ml-6";

  const linkClass = (href: string) => cn(
    "font-medium transition-colors hover:text-primary",
    isMobile 
      ? "text-lg p-2 rounded-md" 
      : "text-sm",
    pathname === href 
      ? (isMobile ? "text-primary bg-muted" : "text-primary")
      : "text-muted-foreground"
  );
  
  if (isMobile) {
    return (
      <nav className={navClass}>
        {filteredNavItems.map((item) => (
          <SheetClose asChild key={item.href}>
             <Link
              href={item.href}
              className={linkClass(item.href)}
            >
              {item.label}
            </Link>
          </SheetClose>
        ))}
      </nav>
    );
  }

  return (
    <nav className={navClass}>
       {filteredNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={linkClass(item.href)}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
