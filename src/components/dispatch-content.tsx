

"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { getPendingDispatchOrders, getProducts, getPlatforms, getCarriers, getPartialDispatchOrders, getDispatchOrders } from '@/lib/api';
import type { DispatchOrder, Product, Platform, Carrier } from '@/lib/types';
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
import { Check, ChevronsUpDown, Calendar as CalendarIcon, X, Search, Download } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';

interface GroupedPendingProduct {
    product: Product;
    totalPending: number;
    guides: {
        trackingNumber: string;
        quantity: number;
    }[];
}

interface DispatchContentProps {
    initialPendingOrders: DispatchOrder[];
    initialPartialOrders: DispatchOrder[];
    initialProducts: Product[];
    initialAllProducts: Product[];
    initialPlatforms: Platform[];
    initialCarriers: Carrier[];
}

export function DispatchContent({
     initialPendingOrders,
     initialPartialOrders,
     initialProducts,
     initialAllProducts,
     initialPlatforms,
     initialCarriers
 }: DispatchContentProps) {
   const { currentWarehouse } = useAuth();
   const [pendingOrders, setPendingOrders] = useState<DispatchOrder[]>(initialPendingOrders);
   const [partialOrders, setPartialOrders] = useState<DispatchOrder[]>(initialPartialOrders);
   const [products, setProducts] = useState<Product[]>(initialProducts);
   const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
   const [carriers, setCarriers] = useState<Carrier[]>(initialCarriers);
   const [productsById, setProductsById] = useState<Record<string, Product>>({});
   const [loading, setLoading] = useState(false);

  // Filter states
  const [filterProductId, setFilterProductId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [filterTrackingNumbers, setFilterTrackingNumbers] = useState('');

  // Search Dialog State
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Tracking Search States
  const [searchTrackingNumbers, setSearchTrackingNumbers] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState({ current: 0, total: 0 });


  const fetchData = async () => {
    setLoading(true);
    const warehouseId = currentWarehouse?.id;
    const [fetchedPendingOrders, fetchedPartialOrders, fetchedProductsResult, fetchedPlatforms, fetchedCarriers] = await Promise.all([
      getPendingDispatchOrders(warehouseId),
      getPartialDispatchOrders(warehouseId),
      getProducts({ limit: 10000, filters: { warehouseId } }),
      getPlatforms(),
      getCarriers(),
    ]);
    setPendingOrders(fetchedPendingOrders);
    setPartialOrders(fetchedPartialOrders);
    setProducts(fetchedProductsResult.products);
    setPlatforms(fetchedPlatforms);
    setCarriers(fetchedCarriers);

    const newProductsById = fetchedProductsResult.products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>);
    setProductsById(newProductsById);
    
    setLoading(false);
  };
  
  useEffect(() => {
    setPendingOrders(initialPendingOrders);
    setPartialOrders(initialPartialOrders);
    setProducts(initialProducts);
    setPlatforms(initialPlatforms);
    setCarriers(initialCarriers);
    const newProductsById = initialAllProducts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>);
    setProductsById(newProductsById);
}, [initialPendingOrders, initialPartialOrders, initialProducts, initialPlatforms, initialCarriers]);


  const platformNames = useMemo(() => 
    platforms.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>),
    [platforms]
  );

  const carrierNames = useMemo(() =>
    carriers.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>),
    [carriers]
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
  
  const filteredProductsForSearch = useMemo(() => {
    if (!searchQuery) return products;
    return products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchQuery, products]);

  const handleProductSearchSelect = (productId: string) => {
    setFilterProductId(productId === filterProductId ? '' : productId);
    setIsSearchDialogOpen(false);
    setSearchQuery('');
  };


  const handleDispatchProcessed = () => {
    fetchData(); // Refresh both lists after an order is processed
  }

  const normalizeTrackingNumber = (trackingNumber: string): string => {
    // If starts with '24' and has 11 digits, add '0' at the beginning (Interrapidisimo/Envía)
    if (trackingNumber.startsWith('24') && trackingNumber.length === 11) {
      return '0' + trackingNumber;
    }
    // If starts with '3' and has 11 digits, prepend '7' and append '001' (for 15-digit guides starting with 7)
    if (trackingNumber.startsWith('3') && trackingNumber.length === 11) {
      return '7' + trackingNumber + '001';
    }
    return trackingNumber;
  };

  const processTrackingBatch = (batch: string[], allOrders: any[]): any[] => {
    return batch.map(originalTrackingNumber => {
      const normalizedTrackingNumber = normalizeTrackingNumber(originalTrackingNumber);
      const foundOrder = allOrders.find(order =>
        order.trackingNumbers?.includes(normalizedTrackingNumber) ||
        order.exceptions?.some((ex: any) => ex.trackingNumber === normalizedTrackingNumber) ||
        order.cancelledExceptions?.some((ex: any) => ex.trackingNumber === normalizedTrackingNumber)
      );

      if (foundOrder) {
        let status: string;
        if (foundOrder.trackingNumbers?.includes(normalizedTrackingNumber)) {
          status = foundOrder.status;
        } else if (foundOrder.exceptions?.some((ex: any) => ex.trackingNumber === normalizedTrackingNumber)) {
          status = 'Pendiente/Excepción';
        } else if (foundOrder.cancelledExceptions?.some((ex: any) => ex.trackingNumber === normalizedTrackingNumber)) {
          status = 'Anulada';
        } else {
          status = 'Desconocido';
        }

        return {
          trackingNumber: originalTrackingNumber,
          status,
          dispatchId: foundOrder.dispatchId,
          date: foundOrder.date.toISOString(),
          platformName: platformNames[foundOrder.platformId],
          carrierName: carrierNames[foundOrder.carrierId],
        };
      } else {
        return {
          trackingNumber: originalTrackingNumber,
          status: 'No despachada',
          dispatchId: null,
          date: null,
          platformName: null,
          carrierName: null,
        };
      }
    });
  };

  const handleSearchTrackingNumbers = async () => {
    const trackingList = searchTrackingNumbers.split('\n').map(t => t.trim()).filter(Boolean);
    if (trackingList.length === 0) return;

    setIsSearching(true);
    setSearchResults([]);
    setSearchProgress({ current: 0, total: trackingList.length });

    try {
      const warehouseId = currentWarehouse?.id;
      const { orders: allOrders } = await getDispatchOrders({ fetchAll: true, filters: { warehouseId } });

      const BATCH_SIZE = 100;
      const batches = [];
      for (let i = 0; i < trackingList.length; i += BATCH_SIZE) {
        batches.push(trackingList.slice(i, i + BATCH_SIZE));
      }

      let allResults: any[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchResults = processTrackingBatch(batch, allOrders);
        allResults = [...allResults, ...batchResults];

        setSearchProgress({ current: Math.min((i + 1) * BATCH_SIZE, trackingList.length), total: trackingList.length });
        setSearchResults([...allResults]);

        // Small delay to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 10));
      }

    } catch (error) {
      console.error('Error searching tracking numbers:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      setSearchProgress({ current: 0, total: 0 });
    }
  };

  const handleExportToExcel = () => {
    if (searchResults.length === 0) return;

    const data = searchResults.map(result => ({
      'Número de Guía': result.trackingNumber,
      'Estado': result.status,
      'Relación (ID Despacho)': result.dispatchId || 'N/A',
      'Fecha': result.date ? formatToTimeZone(new Date(result.date), 'dd/MM/yyyy HH:mm') : 'N/A',
      'Plataforma': result.platformName || 'N/A',
      'Transportadora': result.carrierName || 'N/A',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados de Búsqueda');
    XLSX.writeFile(wb, `resultados_guia_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`);
  };

  const getStatusBadge = (status: 'Pendiente' | 'Despachada' | 'Parcial' | 'Anulada') => {
    switch (status) {
      case 'Pendiente':
        return <Badge variant="destructive">Pendiente</Badge>;
      case 'Despachada':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Despachada</Badge>;
      case 'Parcial':
        return <Badge variant="secondary">Parcial</Badge>;
      case 'Anulada':
        return <Badge variant="outline">Anulada</Badge>;
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
                 <div className="flex gap-2">
                    <Input 
                        readOnly
                        value={filterProductId ? productsById[filterProductId]?.name || '' : ''}
                        placeholder="Seleccionar producto..."
                        className="cursor-pointer"
                        onClick={() => setIsSearchDialogOpen(true)}
                    />
                    <Button variant="outline" size="icon" onClick={() => setIsSearchDialogOpen(true)}>
                        <Search className="h-4 w-4" />
                        <span className="sr-only">Buscar Producto</span>
                    </Button>
                </div>
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
    <>
    <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Buscar Producto</DialogTitle>
                <DialogDescription>
                    Busca un producto por nombre o SKU para filtrar los despachos parciales.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <Input 
                    placeholder="Buscar por nombre o SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                />
                <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead>SKU</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProductsForSearch.length > 0 ? (
                                filteredProductsForSearch.map(product => (
                                    <TableRow 
                                        key={product.id}
                                        onClick={() => handleProductSearchSelect(product.id)}
                                        className={cn("cursor-pointer hover:bg-muted", filterProductId === product.id && "bg-muted")}
                                    >
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell>{product.sku}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center">No se encontraron productos.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </DialogContent>
    </Dialog>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Despacho de Guías</h1>
        <p className="text-muted-foreground">Gestiona y finaliza las órdenes de despacho pendientes y parciales.</p>
      </div>

      <Tabs defaultValue="pendientes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
            <TabsTrigger value="parciales">Parciales</TabsTrigger>
            <TabsTrigger value="buscar">Buscar Guías</TabsTrigger>
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
                                    sku: (productsById[p.productId]?.productType === 'simple' ? productsById[p.productId]?.sku : productsById[p.productId]?.variants?.find(v => v.id === p.variantId)?.sku) || 'N/A',
                                    })) : []
                                );

                                const orderForDialog = { ...order, products: productsForDialog };
                                const groupedPendingProducts = getGroupedPendingProducts(order);

                                return (
                                <AccordionItem value={order.id} key={order.id}>
                                    <AccordionTrigger className="hover:no-underline">
                                      <div className="grid grid-cols-3 items-center w-full">
                                        <div className="text-left">
                                          <p className="font-semibold">{order.dispatchId}</p>
                                          <p className="text-sm text-muted-foreground">
                                            {formatToTimeZone(new Date(order.date), "dd/MM/yyyy HH:mm")}
                                          </p>
                                        </div>
                                        <div className="text-center">
                                          <p className="font-medium">{platformNames[order.platformId]}</p>
                                          <p className="text-sm text-muted-foreground">{carrierNames[order.carrierId]}</p>
                                        </div>
                                        <div className="text-right" onClick={(e) => e.stopPropagation()}>
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
        <TabsContent value="buscar">
            <Card>
                <CardHeader>
                <CardTitle>Buscar Guías de Despacho</CardTitle>
                <CardDescription>
                    Ingresa números de guía para verificar si han sido despachados y obtener detalles. El sistema normaliza automáticamente: guías que empiecen con '24' y tengan 11 dígitos agregando un '0' al inicio, y guías que empiecen con '3' y tengan 11 dígitos agregando '7' al inicio y '001' al final.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="tracking-search">Números de Guía (uno por línea)</Label>
                            <Textarea
                                id="tracking-search"
                                placeholder="GUIA001&#10;GUIA002&#10;GUIA003"
                                value={searchTrackingNumbers}
                                onChange={(e) => setSearchTrackingNumbers(e.target.value)}
                                rows={5}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSearchTrackingNumbers} disabled={isSearching || loading}>
                                {isSearching ? `Buscando... ${searchProgress.current}/${searchProgress.total}` : 'Buscar'}
                            </Button>
                            {searchResults.length > 0 && (
                                <Button onClick={handleExportToExcel} variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Exportar a Excel
                                </Button>
                            )}
                        </div>
                        {isSearching && (
                            <div className="mt-2 text-sm text-muted-foreground">
                                Procesando lote {Math.ceil(searchProgress.current / 100)} de {Math.ceil(searchProgress.total / 100)}...
                            </div>
                        )}
                        {searchResults.length > 0 && (
                            <div className="mt-6">
                                <h4 className="text-lg font-semibold mb-4">Resultados de Búsqueda</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Número de Guía</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Relación (ID Despacho)</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Plataforma</TableHead>
                                            <TableHead>Transportadora</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {searchResults.map((result, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono">{result.trackingNumber}</TableCell>
                                                <TableCell>{getStatusBadge(result.status)}</TableCell>
                                                <TableCell>{result.dispatchId || 'N/A'}</TableCell>
                                                <TableCell>{result.date ? formatToTimeZone(new Date(result.date), 'dd/MM/yyyy HH:mm') : 'N/A'}</TableCell>
                                                <TableCell>{result.platformName || 'N/A'}</TableCell>
                                                <TableCell>{result.carrierName || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
