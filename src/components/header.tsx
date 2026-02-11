
"use client";

import { Bell, Menu, Package, Building } from 'lucide-react';
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
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import MainNav from './main-nav';
import { Logo } from './logo';
import Link from 'next/link';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';

export default function AppHeader() {
  const { user, logout, warehouses, currentWarehouse } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  if (!user || pathname === '/login') {
    return null;
  }
  
  const handleWarehouseChange = (warehouseId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (warehouseId === 'all') {
      params.delete('warehouse');
    } else {
      params.set('warehouse', warehouseId);
    }
    // Reset page for paginated views
    if (params.has('page')) {
      params.set('page', '1');
    }
    if (params.has('movementsPage')) {
      params.set('movementsPage', '1');
    }
    if (params.has('ordersPage')) {
      params.set('ordersPage', '1');
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <header className="flex h-24 items-center gap-6 border-b bg-card px-6 lg:px-8 sticky top-0 z-20">
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
                    <div className="mb-6 mt-4 pl-2">
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

      <div className="hidden md:flex items-center pl-2">
        <Logo />
      </div>
      
      <div className="hidden md:flex flex-1 pl-4">
        <MainNav />
      </div>

      <div className="flex items-center gap-4 ml-auto">
        {user.role !== 'logistics' && (
          <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-muted-foreground" />
              <Select
                  value={currentWarehouse?.id || 'all'}
                  onValueChange={handleWarehouseChange}
              >
                  <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Seleccionar bodega" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">Todas las Bodegas</SelectItem>
                      {warehouses.map(wh => (
                          <SelectItem
                              key={wh.id}
                              value={wh.id}
                          >
                              {wh.name}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          </div>
        )}
        {user.role === 'logistics' && currentWarehouse && (
          <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{currentWarehouse.name}</span>
          </div>
        )}

        <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Ver notificaciones</span>
        </Button>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-9 w-9">
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
