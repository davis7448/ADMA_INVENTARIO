

"use client";

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { getPendingDispatchOrders, getProducts, getPlatforms, getCarriers, getPartialDispatchOrders } from '@/lib/api';
import type { DispatchOrder, Product, Platform, Carrier } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatToTimeZone, cn } from '@/lib/utils';
import { ProcessDispatchDialog } from '@/components/process-dispatch-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Check, ChevronsUpDown, Calendar as CalendarIcon, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface GroupedPendingProduct {
    product: Product;
    totalPending: number;
    guides: {
        trackingNumber: string;
        quantity: number;
    }[];
}


function DispatchPageContent() {
  const [pendingOrders, setPendingOrders] = useState<DispatchOrder[]>([]);
  const [partialOrders, setPartialOrders] = useState<DispatchOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filterProductId, setFilterProductId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [filterTrackingNumbers, setFilterTrackingNumbers] = useState('');
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [fetchedPendingOrders, fetchedPartialOrders, fetchedProducts, fetchedPlatforms, fetchedCarriers] = await Promise.all([
      getPendingDispatchOrders(),
      getPartialDispatchOrders(),
      getProducts(),
      getPlatforms(),
      getCarriers(),
    ]);
    setPendingOrders(fetchedPendingOrders);
    setPartialOrders(fetchedPartialOrders);
    setProducts(fetchedProducts);
    setPlatforms(fetchedPlatforms);
    setCarriers(fetchedCarriers);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const platformNames = useMemo(() => 
    platforms.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>),
    [platforms]
  );

  const carrierNames = useMemo(() =>
    carriers.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>),
    [carriers]
  );
  
  const productsById = useMemo(() =>
    products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>),
    [products]
  );

  const filteredPartialOrders = useMemo(() => {
    let allOrders = [...partialOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const trackingList = filterTrackingNumbers.split('\n').map(t => t.trim()).filter(Boolean);

    if (filterProductId) {
        allOrders = allOrders.filter(order => order.exceptions.some(ex => ex.products?.some(p => p.productId === filterProductId)));
    }
    if (dateRange?.from) {
        allOrders = allOrders.filter(order => new Date(order.date) >= startOfDay(dateRange.from!));
    }
    if (dateRange?.to) {
        allOrders = allOrders.filter(order => new Date(order.date) <= endOfDay(dateRange.to!));
    }
    if (trackingList.length > 0) {
        allOrders = allOrders.filter(order => order.exceptions.some(ex => trackingList.includes(ex.trackingNumber)));
    }
    
    return allOrders;
  }, [partialOrders, filterProductId, dateRange, filterTrackingNumbers]);


  const handleDispatchProcessed = () => {
    fetchData(); // Refresh both lists after an order is processed
  }

  const getStatusBadge = (status: 'Pendiente' | 'Despachada' | 'Parcial') => {
    switch (status) {
      case 'Pendiente':
        return <Badge variant="destructive">Pendiente</Badge>;
      case 'Despachada':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Despachada</Badge>;
      case 'Parcial':
        return <Badge variant="secondary">Parcial</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const clearFilters = () => {
    setFilterProductId('');
    setDateRange(undefined);
    setFilterTrackingNumbers('');
  };
  const hasActiveFilters = filterProductId || dateRange || filterTrackingNumbers;

  const renderFilters = () => (
    <div className="mb-6 space-y-4 p-4 border rounded-lg bg-muted/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
                <Label>Filtrar por producto</Label>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={comboboxOpen}
                            className="w-full justify-between"
                        >
                            {filterProductId
                                ? products.find((p) => p.id === filterProductId)?.name
                                : "Filtrar por producto pendiente..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="Buscar producto..." />
                            <CommandEmpty>No se encontró el producto.</CommandEmpty>
                            <CommandGroup>
                                {products.map((p) => (
                                    <CommandItem
                                        key={p.id}
                                        value={p.name}
                                        onSelect={() => {
                                            setFilterProductId(p.id === filterProductId ? '' : p.id)
                                            setComboboxOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                filterProductId === p.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {p.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
            
             <div className="space-y-2">
                <Label>Filtrar por fecha</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(dateRange.from, "LLL dd, y")
                            )
                            ) : (
                            <span>Rango de fechas</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
            </div>

            <div className="space-y-2">
                    <Label htmlFor="tracking-filter">Filtrar por guías (una por línea)</Label>
                    <Textarea
                        id="tracking-filter"
                        placeholder="GUIA001\nGUIA002\nGUIA003"
                        value={filterTrackingNumbers}
                        onChange={(e) => setFilterTrackingNumbers(e.target.value)}
                        rows={3}
                    />
                </div>
        </div>
        <div className="flex items-center gap-4 mt-2">
             {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                    <X className="mr-2 h-4 w-4" />
                    Limpiar filtros
                </Button>
            )}
        </div>
    </div>
  );

  const getGroupedPendingProducts = (order: DispatchOrder): GroupedPendingProduct[] => {
    const pendingProducts: { [key: string]: GroupedPendingProduct } = {};

    order.exceptions?.forEach(ex => {
        ex.products?.forEach(p => {
            if (!pendingProducts[p.productId]) {
                const productInfo = productsById[p.productId];
                if (productInfo) {
                    pendingProducts[p.productId] = {
                        product: productInfo,
                        totalPending: 0,
                        guides: [],
                    };
                }
            }
            if (pendingProducts[p.productId]) {
                pendingProducts[p.productId].totalPending += p.quantity;
                pendingProducts[p.productId].guides.push({
                    trackingNumber: ex.trackingNumber,
                    quantity: p.quantity,
                });
            }
        });
    });
    return Object.values(pendingProducts);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Despacho de Guías</h1>
        <p className="text-muted-foreground">Gestiona y finaliza las órdenes de despacho pendientes y parciales.</p>
      </div>

      <Tabs defaultValue="pendientes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
            <TabsTrigger value="parciales">Parciales</TabsTrigger>
        </TabsList>
        <TabsContent value="pendientes">
            <Card>
                <CardHeader>
                <CardTitle>Órdenes de Despacho Pendientes</CardTitle>
                <CardDescription>
                    Estas son las órdenes que han sido preparadas (picking) y están listas para la asignación de guías y envío final.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>ID Despacho</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Plataforma</TableHead>
                            <TableHead>Transportadora</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                            </TableRow>
                            ))
                        ) : pendingOrders.length > 0 ? (
                            pendingOrders.map((order) => {
                            const productsForDialog = order.products;

                            const orderForDialog = { ...order, products: productsForDialog };
                            
                            return (
                            <TableRow key={order.id}>
                                <TableCell className="font-medium">{order.dispatchId}</TableCell>
                                <TableCell>{formatToTimeZone(new Date(order.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                                <TableCell>{platformNames[order.platformId] || 'N/A'}</TableCell>
                                <TableCell>{carrierNames[order.carrierId] || 'N/A'}</TableCell>
                                <TableCell>{order.totalItems}</TableCell>
                                <TableCell>{getStatusBadge(order.status)}</TableCell>
                                <TableCell className="text-right">
                                    <ProcessDispatchDialog 
                                        order={orderForDialog}
                                        productsById={productsById}
                                        onDispatchProcessed={handleDispatchProcessed}
                                    >
                                        <Button>Procesar Despacho</Button>
                                    </ProcessDispatchDialog>
                                </TableCell>
                            </TableRow>
                            );
                            })
                        ) : (
                            <TableRow>
                            <TableCell colSpan={7} className="text-center h-24">
                                No hay órdenes pendientes.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="parciales">
            <Card>
                <CardHeader>
                <CardTitle>Órdenes con Despacho Parcial</CardTitle>
                <CardDescription>
                    Estas órdenes tuvieron excepciones. Desde aquí puedes procesar el despacho de los productos que quedaron pendientes.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    {renderFilters()}
                    {loading ? (
                         <div className="space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : filteredPartialOrders.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                           {filteredPartialOrders.map((order) => {
                                const productsForDialog = order.exceptions.flatMap(ex =>
                                    ex.products ? ex.products.map(p => ({
                                    ...p,
                                    name: productsById[p.productId]?.name || 'N/A',
                                    sku: productsById[p.productId]?.sku || 'N/A',
                                    })) : []
                                );

                                const orderForDialog = { ...order, products: productsForDialog };
                                const groupedPendingProducts = getGroupedPendingProducts(order);

                                return (
                                <AccordionItem value={order.id} key={order.id}>
                                    <AccordionTrigger>
                                        <div className="grid grid-cols-3 w-full items-center text-sm px-4">
                                            <div className="text-left">
                                                <p className="font-semibold">{order.dispatchId}</p>
                                                <p className="text-muted-foreground">
                                                    {formatToTimeZone(new Date(order.date), "dd/MM/yyyy HH:mm")}
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <p className="font-medium">{platformNames[order.platformId]}</p>
                                                <p className="text-muted-foreground">{carrierNames[order.carrierId]}</p>
                                            </div>
                                            <div className="text-right flex justify-end items-center gap-2">
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <ProcessDispatchDialog 
                                                        order={orderForDialog}
                                                        productsById={productsById}
                                                        onDispatchProcessed={handleDispatchProcessed}
                                                    >
                                                        <Button>Procesar Pendientes</Button>
                                                    </ProcessDispatchDialog>
                                                </div>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="p-4 bg-muted/50 rounded-md">
                                            <h4 className="font-semibold mb-4 text-destructive">Productos Pendientes (Excepciones)</h4>
                                            <div className="space-y-4">
                                                {groupedPendingProducts.map(group => (
                                                    <div key={group.product.id} className="border p-3 rounded-md bg-background">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <Image 
                                                                    src={group.product.imageUrl} 
                                                                    alt={group.product.name} 
                                                                    width={64} height={64} 
                                                                    className="rounded-md object-cover"
                                                                />
                                                                <div>
                                                                    <p className="font-semibold">{group.product.name}</p>
                                                                    <p className="text-sm text-muted-foreground">{group.product.sku}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm text-muted-foreground">Total Pendiente</p>
                                                                <p className="text-2xl font-bold">{group.totalPending}</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3">
                                                            <p className="text-xs font-semibold text-muted-foreground mb-1">Desglose por Guía de Excepción:</p>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Guía</TableHead>
                                                                        <TableHead className="text-right">Cantidad</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {group.guides.map((guide, idx) => (
                                                                        <TableRow key={idx}>
                                                                            <TableCell className="font-mono text-xs">{guide.trackingNumber}</TableCell>
                                                                            <TableCell className="text-right">{guide.quantity}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                );
                           })}
                        </Accordion>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">
                            {hasActiveFilters ? "No se encontraron despachos parciales para los filtros seleccionados." : "No hay órdenes con despacho parcial."}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DispatchPage() {
    return (
        <AuthProviderWrapper allowedRoles={['admin', 'logistics']}>
            <DispatchPageContent />
        </AuthProviderWrapper>
    )
}
