
"use client";

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
import { getInventoryMovements, getProducts, getPlatforms, getCarriers } from '@/lib/api';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import type { InventoryMovement, Product, Platform, Carrier } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Download, X, Calendar as CalendarIcon, Check, ChevronsUpDown, FileSpreadsheet } from 'lucide-react';
import { generatePickingListPDF } from '@/lib/pdf';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';


interface DispatchOrderProduct {
    productId: string;
    name: string;
    sku: string;
    quantity: number;
}

interface DispatchOrder {
  id: string;
  date: string;
  totalItems: number;
  platform: string;
  carrier: string;
  products: DispatchOrderProduct[];
}

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filterProductId, setFilterProductId] = useState<string>('');
  const [filterPlatformId, setFilterPlatformId] = useState<string>('');
  const [filterCarrierId, setFilterCarrierId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [comboboxOpen, setComboboxOpen] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'logistics' && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    async function fetchData() {
        setLoading(true);
        const [
            fetchedMovements, 
            fetchedProducts, 
            fetchedPlatforms, 
            fetchedCarriers
        ] = await Promise.all([
            getInventoryMovements(),
            getProducts(),
            getPlatforms(),
            getCarriers()
        ]);
        setMovements(fetchedMovements);
        setProducts(fetchedProducts);
        setPlatforms(fetchedPlatforms);
        setCarriers(fetchedCarriers);
        setLoading(false);
    }
    fetchData();
  }, []);
  
  const sortedMovements = useMemo(() => 
    [...movements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [movements]
  );
  
  const filteredMovements = useMemo(() => {
    let allMovements = [...sortedMovements];

    if (filterProductId) {
        allMovements = allMovements.filter(m => m.productId === filterProductId);
    }
    if (filterPlatformId) {
        const platformName = platforms.find(p => p.id === filterPlatformId)?.name;
        allMovements = allMovements.filter(m => m.notes.includes(`Plataforma: ${platformName}`));
    }
    if (filterCarrierId) {
        const carrierName = carriers.find(c => c.id === filterCarrierId)?.name;
        allMovements = allMovements.filter(m => m.notes.includes(`Transportadora: ${carrierName}`));
    }
    if (dateRange?.from) {
        allMovements = allMovements.filter(m => new Date(m.date) >= startOfDay(dateRange.from!));
    }
    if (dateRange?.to) {
        allMovements = allMovements.filter(m => new Date(m.date) <= endOfDay(dateRange.to!));
    }

    return allMovements;
  }, [sortedMovements, platforms, carriers, filterProductId, filterPlatformId, filterCarrierId, dateRange]);


  const dispatchOrders = useMemo(() => {
    const dispatches: Record<string, DispatchOrder> = {};
    const salidaMovements = movements.filter(m => m.type === 'Salida' && m.notes.includes('Dispatch ID:'));
    const productsById = new Map(products.map(p => [p.id, p]));
    
    salidaMovements.forEach(m => {
        const match = m.notes.match(/Dispatch ID: (.*?)\./);
        if (!match) return;
        const dispatchId = match[1];

        const platformMatch = m.notes.match(/Plataforma: (.*?)\,/);
        const carrierMatch = m.notes.match(/Transportadora: (.*)/);

        if (!dispatches[dispatchId]) {
            dispatches[dispatchId] = {
                id: dispatchId,
                date: m.date,
                totalItems: 0,
                platform: platformMatch ? platformMatch[1] : 'N/A',
                carrier: carrierMatch ? carrierMatch[1] : 'N/A',
                products: [],
            };
        }
        
        const product = productsById.get(m.productId);
        
        dispatches[dispatchId].products.push({ productId: m.productId, name: m.productName, sku: product?.sku || 'N/A', quantity: m.quantity });
        dispatches[dispatchId].totalItems += m.quantity;
    });

    let allOrders = Object.values(dispatches).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (filterProductId) {
        allOrders = allOrders.filter(order => order.products.some(p => p.productId === filterProductId));
    }
    if (filterPlatformId) {
        const platformName = platforms.find(p => p.id === filterPlatformId)?.name;
        allOrders = allOrders.filter(order => order.platform === platformName);
    }
    if (filterCarrierId) {
        const carrierName = carriers.find(c => c.id === filterCarrierId)?.name;
        allOrders = allOrders.filter(order => order.carrier === carrierName);
    }
    if (dateRange?.from) {
        allOrders = allOrders.filter(order => new Date(order.date) >= startOfDay(dateRange.from!));
    }
    if (dateRange?.to) {
        allOrders = allOrders.filter(order => new Date(order.date) <= endOfDay(dateRange.to!));
    }
    
    return allOrders;

  }, [movements, products, platforms, carriers, filterProductId, filterPlatformId, filterCarrierId, dateRange]);

  const handleDownloadPdf = (order: DispatchOrder) => {
    const productsForPdf = order.products.map(p => ({ ...p, dispatchQuantity: p.quantity }));
    generatePickingListPDF(order.id, productsForPdf, order.platform, order.carrier, new Date(order.date));
  };
  
  const clearFilters = () => {
    setFilterProductId('');
    setFilterPlatformId('');
    setFilterCarrierId('');
    setDateRange(undefined);
  };
  const hasActiveFilters = filterProductId || filterPlatformId || filterCarrierId || dateRange;

  const handleExportMovementsExcel = () => {
    const productsById = new Map(products.map(p => [p.id, p]));
    const flattenedData = filteredMovements.map(movement => ({
        'ID Movimiento': movement.id,
        'Fecha': format(new Date(movement.date), "dd/MM/yyyy HH:mm"),
        'Tipo': movement.type,
        'SKU Producto': productsById.get(movement.productId)?.sku || 'N/A',
        'Nombre Producto': movement.productName,
        'Cantidad': movement.quantity,
        'Notas': movement.notes,
    }));

    const worksheet = XLSX.utils.json_to_sheet(flattenedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");
    XLSX.writeFile(workbook, `Historial-Movimientos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const getBadgeClass = (type: 'Entrada' | 'Salida') => {
    switch (type) {
      case 'Entrada':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'Salida':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      default:
        return '';
    }
  };
  
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
                            : "Filtrar por producto..."}
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

            <Select value={filterPlatformId} onValueChange={setFilterPlatformId}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                    {platforms.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select value={filterCarrierId} onValueChange={setFilterCarrierId}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Transportadora" />
                </SelectTrigger>
                <SelectContent>
                    {carriers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
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

  if (user?.role !== 'logistics' && user?.role !== 'admin') {
    return (
        <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Historial de Inventario</h1>
        <p className="text-muted-foreground">Un registro de todas las transacciones de stock.</p>
      </div>

      <Tabs defaultValue="movements" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="movements">Movimientos</TabsTrigger>
              <TabsTrigger value="dispatches">Órdenes de Despacho</TabsTrigger>
          </TabsList>
          
          <TabsContent value="movements">
            <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Movimientos Recientes</CardTitle>
                        <CardDescription>
                            Mostrando las últimas entradas y salidas de inventario.
                        </CardDescription>
                      </div>
                      <Button variant="outline" onClick={handleExportMovementsExcel}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Exportar a Excel
                      </Button>
                  </div>
                </CardHeader>
                <CardContent>
                {renderFilters()}
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-center">Cantidad</TableHead>
                        <TableHead>Notas</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            </TableRow>
                        ))
                    ) : filteredMovements.length > 0 ? (
                        filteredMovements.map((movement) => (
                        <TableRow key={movement.id}>
                            <TableCell className="font-medium">
                            {format(new Date(movement.date), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell>{movement.productName}</TableCell>
                            <TableCell>
                            <Badge variant="outline" className={getBadgeClass(movement.type)}>
                                {movement.type}
                            </Badge>
                            </TableCell>
                            <TableCell className="text-center">{movement.quantity}</TableCell>
                            <TableCell className="text-muted-foreground">{movement.notes}</TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={5} className="text-center">
                            {hasActiveFilters
                                ? "No se encontraron movimientos para los filtros seleccionados."
                                : "No hay movimientos de inventario registrados."
                            }
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dispatches">
            <Card>
                <CardHeader>
                  <CardTitle>Órdenes de Despacho Generadas</CardTitle>
                  <CardDescription>
                      Un historial de todos los picking lists generados. Filtra para encontrar órdenes específicas.
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
                    ) : dispatchOrders.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {dispatchOrders.map((order) => (
                                <AccordionItem value={order.id} key={order.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <div className="text-left">
                                                <p className="font-semibold">{order.id}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {format(new Date(order.date), "dd/MM/yyyy HH:mm")} - {order.totalItems} items
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium">{order.platform}</p>
                                                <p className="text-sm text-muted-foreground">{order.carrier}</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-4">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Producto</TableHead>
                                                        <TableHead>SKU</TableHead>
                                                        <TableHead className="text-right">Cantidad</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {order.products.map((p, i) => (
                                                        <TableRow key={i} className={p.productId === filterProductId ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                                                            <TableCell>{p.name}</TableCell>
                                                            <TableCell>{p.sku}</TableCell>
                                                            <TableCell className="text-right">{p.quantity}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <div className="flex justify-end">
                                                <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(order)}>
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar PDF
                                                </Button>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">
                            {hasActiveFilters
                                ? "No se encontraron órdenes de despacho para los filtros seleccionados."
                                : "No se han generado órdenes de despacho."
                            }
                        </div>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
      </Tabs>
    </div>
  );
}

    