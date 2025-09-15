"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import MainNav from '@/components/main-nav';
import { Logo } from '@/components/logo';
import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';

export default function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user || pathname === '/login') {
    return null;
  }
  
  return (
    <Sidebar>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <MainNav />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        {/* Can add user profile or settings link here */}
      </SidebarFooter>
    </Sidebar>
  );
}
