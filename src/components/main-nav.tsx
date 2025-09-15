"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', roles: ['admin', 'logistics', 'commercial'] },
  { href: '/products', label: 'Products', roles: ['admin', 'commercial'] },
  { href: '/logistics', label: 'Logística', roles: ['admin', 'logistics'] },
];

export default function MainNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <nav className="hidden md:flex items-center space-x-4 lg:space-x-6 ml-6">
      {filteredNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            pathname === item.href ? "text-primary" : "text-muted-foreground"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
