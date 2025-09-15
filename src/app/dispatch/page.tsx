
"use client";

import { useEffect, useState, useMemo } from 'react';
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

    if (filterProductId) {
        allOrders = allOrders.filter(order => order.exceptions.some(ex => ex.products?.some(p => p.productId === filterProductId)));
    }
    if (dateRange?.from) {
        allOrders = allOrders.filter(order => new Date(order.date) >= startOfDay(dateRange.from!));
    }
    if (dateRange?.to) {
        allOrders = allOrders.filter(order => new Date(order.date) <= endOfDay(dateRange.to!));
    }
    
    return allOrders;
  }, [partialOrders, filterProductId, dateRange]);


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
  };
  const hasActiveFilters = filterProductId || dateRange;

  const renderFilters = () => (
    <div className="mb-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboboxOpen}
                        className="w-full md:w-[250px] justify-between"
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
            
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-full md:w-[240px] justify-start text-left font-normal",
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
        <div className="flex items-center gap-4">
             {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                    <X className="mr-2 h-4 w-4" />
                    Limpiar filtros
                </Button>
            )}
        </div>
    </div>
  );

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

                                return (
                                <AccordionItem value={order.id} key={order.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <div className="text-left">
                                                <p className="font-semibold">{order.dispatchId}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatToTimeZone(new Date(order.date), "dd/MM/yyyy HH:mm")}
                                                </p>
                                            </div>
                                            <div className="text-center px-4">
                                                <p className="text-sm font-medium">{platformNames[order.platformId]}</p>
                                                <p className="text-sm text-muted-foreground">{carrierNames[order.carrierId]}</p>
                                            </div>
                                            <div className="text-right">
                                                 <ProcessDispatchDialog 
                                                    order={orderForDialog}
                                                    productsById={productsById}
                                                    onDispatchProcessed={handleDispatchProcessed}
                                                >
                                                    <Button>Procesar Pendientes</Button>
                                                </ProcessDispatchDialog>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="p-4 bg-muted/50 rounded-md">
                                            <h4 className="font-semibold mb-2 text-destructive">Productos Pendientes (Excepciones)</h4>
                                            {order.exceptions.map((ex, index) => (
                                                <div key={index} className="mb-3">
                                                    <p className="text-sm font-semibold">Guía de Excepción: <span className="font-mono bg-destructive/10 px-2 py-1 rounded">{ex.trackingNumber}</span></p>
                                                    {ex.products && ex.products.length > 0 && (
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Producto</TableHead>
                                                                    <TableHead className="text-right">Cant. Pendiente</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {ex.products.map(p => (
                                                                    <TableRow key={p.productId}>
                                                                        <TableCell>{productsById[p.productId]?.name || 'Producto desconocido'}</TableCell>
                                                                        <TableCell className="text-right">{p.quantity}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    )}
                                                </div>
                                            ))}
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

    