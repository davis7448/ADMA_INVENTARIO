
"use client";

import { Bell, Menu, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';
import MainNav from './main-nav';
import { Logo } from './logo';
import Link from 'next/link';

export default function AppHeader() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user || pathname === '/login') {
    return null;
  }
  
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4 md:hidden">
         <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
                <div className="flex flex-col h-full">
                    <div className="mb-6">
                        <Logo />
                    </div>
                    <MainNav isMobile />
                    <div className="mt-auto">
                        <SheetClose asChild>
                            <Button variant="outline" className="w-full" onClick={logout}>Cerrar Sesión</Button>
                        </SheetClose>
                    </div>
                </div>
            </SheetContent>
          </Sheet>
      </div>

      <div className="hidden md:flex">
        <Logo />
      </div>
      
      <div className="hidden md:flex flex-1">
        <MainNav />
      </div>


      <div className="flex items-center gap-4 ml-auto">
        <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Ver notificaciones</span>
        </Button>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="sr-only">Menú de usuario</span>
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mi Cuenta ({user.role})</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link href="/settings">
              <DropdownMenuItem>Configuración</DropdownMenuItem>
            </Link>
            <DropdownMenuItem>Soporte</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>Cerrar Sesión</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
