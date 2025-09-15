

"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { getDispatchOrders, getProducts, getCarriers, getCategories, getInventoryMovements, getPlatforms } from '@/lib/api';
import type { DispatchOrder, Product, Carrier, Category, InventoryMovement, Platform } from '@/lib/types';
import { CalendarIcon, PackageCheck, PackageX, CornerDownLeft, Check, ChevronsUpDown, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import DashboardOrdersChart from '@/components/dashboard-orders-chart';
import DashboardPendingChart from '@/components/dashboard-pending-chart';
import { Skeleton } from '@/components/ui/skeleton';
import DashboardCategoryChart from '@/components/dashboard-category-chart';
import DashboardReturnsChart from '@/components/dashboard-returns-chart';
import { Progress } from '@/components/ui/progress';
import DashboardPlatformCarrierChart from '@/components/dashboard-platform-carrier-chart';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';


export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });
  const [allOrders, setAllOrders] = useState<DispatchOrder[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCarriers, setAllCarriers] = useState<Carrier[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allPlatforms, setAllPlatforms] = useState<Platform[]>([]);
  const [allMovements, setAllMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterCarrier, setFilterCarrier] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterProduct, setFilterProduct] = useState('');
  const [productComboboxOpen, setProductComboboxOpen] = useState(false);


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [orders, products, carriers, categories, platforms, movements] = await Promise.all([
          getDispatchOrders(), 
          getProducts(), 
          getCarriers(),
          getCategories(),
          getPlatforms(),
          getInventoryMovements() // Fetch all movements
        ]);
      setAllOrders(orders);
      setAllProducts(products);
      setAllCarriers(carriers);
      setAllCategories(categories);
      setAllPlatforms(platforms);
      setAllMovements(movements);
      setLoading(false);
    };
    fetchData();
  }, []);

  const clearFilters = () => {
    setFilterPlatform('all');
    setFilterCarrier('all');
    setFilterCategory('all');
    setFilterProduct('');
  };

  const hasActiveFilters = filterPlatform !== 'all' || filterCarrier !== 'all' || filterCategory !== 'all' || filterProduct !== '';

  const filteredData = useMemo(() => {
    const fromDate = dateRange?.from ? startOfDay(dateRange.from) : new Date(0);
    const toDate = dateRange?.to ? endOfDay(dateRange.to) : new Date();

    const productIdsInCategory = filterCategory === 'all' 
        ? null 
        : allProducts.filter(p => p.categoryId === filterCategory).map(p => p.id);

    let ordersInPeriod = allOrders.filter(order => {
        const orderDate = new Date(order.date);
        const dateMatch = orderDate >= fromDate && orderDate <= toDate;
        const platformMatch = filterPlatform === 'all' || order.platformId === filterPlatform;
        const carrierMatch = filterCarrier === 'all' || order.carrierId === filterCarrier;
        
        let productMatch = true;
        if (filterProduct) {
            productMatch = order.products.some(p => p.productId === filterProduct);
        } else if (productIdsInCategory) {
            productMatch = order.products.some(p => productIdsInCategory.includes(p.productId));
        }

        return dateMatch && platformMatch && carrierMatch && productMatch;
    });

    const totalItemsDispatched = ordersInPeriod.reduce((sum, order) => sum + order.totalItems, 0);

    const pendingAndPartialInPeriod = ordersInPeriod.filter(
        order => order.status === 'Pendiente' || order.status === 'Parcial'
    );
    const totalPendingOrders = pendingAndPartialInPeriod.length;

    const returnMovementsInPeriod = allMovements.filter(m => {
        const movementDate = new Date(m.date);
        const isReturn = m.type === 'Entrada' && (m.notes.toLowerCase().includes('devolución') || m.notes.toLowerCase().includes('averia'));
        if (!isReturn || !(movementDate >= fromDate && movementDate <= toDate)) {
            return false;
        }

        let productMatch = true;
        if (filterProduct) {
            productMatch = m.productId === filterProduct;
        } else if (productIdsInCategory) {
            productMatch = productIdsInCategory.includes(m.productId);
        }
        return productMatch;
    });

    const totalReturns = returnMovementsInPeriod.reduce((sum, m) => sum + m.quantity, 0);

    const returnsByDay = returnMovementsInPeriod.reduce((acc, m) => {
        const day = format(new Date(m.date), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + m.quantity;
        return acc;
    }, {} as Record<string, number>);

    const ordersByDay = ordersInPeriod.reduce((acc, order) => {
        const day = format(new Date(order.date), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + order.totalItems; // Aggregate by items now
        return acc;
    }, {} as Record<string, number>);

    const pendingByDay: Record<string, number> = pendingAndPartialInPeriod.reduce((acc, order) => {
        const day = format(new Date(order.date), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {});


    const chartData = [];
    const pendingChartData = [];
    const returnsChartData = [];
    let currentDate = new Date(fromDate);
    
    while (currentDate <= toDate) {
        const dayKey = format(currentDate, 'yyyy-MM-dd');
        chartData.push({
            date: dayKey,
            orders: ordersByDay[dayKey] || 0,
        });
        pendingChartData.push({
            date: dayKey,
            orders: pendingByDay[dayKey] || 0,
        });
        returnsChartData.push({
            date: dayKey,
            returns: returnsByDay[dayKey] || 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const productInfoMap = allProducts.reduce((acc, product) => {
        acc[product.id] = { name: product.name, categoryId: product.categoryId };
        return acc;
    }, {} as Record<string, {name: string, categoryId: string}>);

    const categoryNameMap = allCategories.reduce((acc, category) => {
        acc[category.id] = category.name;
        return acc;
    }, {} as Record<string, string>);
    
    const platformNameMap = allPlatforms.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>);
    const carrierNameMap = allCarriers.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>);

    const salesByProduct: Record<string, number> = {};
    const salesByCategory: Record<string, number> = {};
    let totalItemsSold = 0;

    ordersInPeriod.forEach(order => {
        order.products.forEach(p => {
            // Aggregate by product
            salesByProduct[p.productId] = (salesByProduct[p.productId] || 0) + p.quantity;
            
            // Aggregate by category
            const categoryId = productInfoMap[p.productId]?.categoryId;
            if (categoryId) {
                salesByCategory[categoryId] = (salesByCategory[categoryId] || 0) + p.quantity;
            }
            totalItemsSold += p.quantity;
        });
    });

    const productChartData = Object.entries(salesByProduct)
        .map(([productId, count]) => ({
            name: productInfoMap[productId]?.name || 'Unknown',
            value: count,
            percentage: totalItemsSold > 0 ? (count / totalItemsSold) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value);

    const categoryChartData = Object.entries(salesByCategory)
        .map(([categoryId, count]) => ({
            name: categoryNameMap[categoryId] || 'Unknown',
            value: count,
            percentage: totalItemsSold > 0 ? (count / totalItemsSold) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value);

    // Data for Platform/Carrier Chart
    const platformCarrierData: any[] = [];
    const platformCarrierMap: { [platformId: string]: { [carrierId: string]: number } } = {};
    const platformOrderCount: { [platformId: string]: number } = {};
    const carrierUsageCount: { [carrierId: string]: number } = {};
    let totalProductsShipped = 0;

    ordersInPeriod.forEach(order => {
        const platformName = platformNameMap[order.platformId] || 'Unknown Platform';
        const carrierName = carrierNameMap[order.carrierId] || 'Unknown Carrier';

        if (!platformCarrierMap[platformName]) {
            platformCarrierMap[platformName] = {};
        }
        platformCarrierMap[platformName][carrierName] = (platformCarrierMap[platformName][carrierName] || 0) + order.totalItems;

        platformOrderCount[platformName] = (platformOrderCount[platformName] || 0) + 1;
        carrierUsageCount[carrierName] = (carrierUsageCount[carrierName] || 0) + order.totalItems;
        totalProductsShipped += order.totalItems;
    });

    for (const platformName in platformCarrierMap) {
        platformCarrierData.push({
            name: platformName,
            ...platformCarrierMap[platformName]
        });
    }

    const mostUsedCarrierEntry = Object.entries(carrierUsageCount).sort((a, b) => b[1] - a[1])[0];
    const mostUsedCarrier = {
        name: mostUsedCarrierEntry?.[0] || 'N/A',
        count: mostUsedCarrierEntry?.[1] || 0,
        percentage: totalProductsShipped > 0 ? ((mostUsedCarrierEntry?.[1] || 0) / totalProductsShipped) * 100 : 0,
    };

    const platformWithMostOrdersEntry = Object.entries(platformOrderCount).sort((a, b) => b[1] - a[1])[0];
    const totalOrdersInPeriod = ordersInPeriod.length;
    const platformWithMostOrders = {
        name: platformWithMostOrdersEntry?.[0] || 'N/A',
        count: platformWithMostOrdersEntry?.[1] || 0,
        percentage: totalOrdersInPeriod > 0 ? ((platformWithMostOrdersEntry?.[1] || 0) / totalOrdersInPeriod) * 100 : 0,
    };


    return {
      totalItemsDispatched,
      totalPendingOrders,
      totalReturns,
      returnsChartData,
      pendingChartData,
      chartData,
      productChartData,
      categoryChartData,
      platformCarrierChartData: platformCarrierData,
      allCarrierNames: Object.values(carrierNameMap),
      mostUsedCarrier,
      platformWithMostOrders,
    };
  }, [dateRange, allOrders, allCarriers, allProducts, allCategories, allPlatforms, allMovements, filterPlatform, filterCarrier, filterCategory, filterProduct]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-headline tracking-tight">Dashboard Operativo</h1>
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                        "w-[260px] justify-start text-left font-normal",
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
                        <span>Seleccionar rango</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
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

       <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Filtros Avanzados</CardTitle>
                    {hasActiveFilters && <Button variant="ghost" onClick={clearFilters}>Limpiar Filtros</Button>}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="platform-filter">Plataforma</Label>
                        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                            <SelectTrigger id="platform-filter"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las Plataformas</SelectItem>
                                {allPlatforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="carrier-filter">Transportadora</Label>
                        <Select value={filterCarrier} onValueChange={setFilterCarrier}>
                            <SelectTrigger id="carrier-filter"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las Transportadoras</SelectItem>
                                {allCarriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="category-filter">Categoría</Label>
                        <Select value={filterCategory} onValueChange={(value) => { setFilterCategory(value); setFilterProduct(''); }}>
                            <SelectTrigger id="category-filter"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las Categorías</SelectItem>
                                {allCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Producto</Label>
                        <Popover open={productComboboxOpen} onOpenChange={setProductComboboxOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={productComboboxOpen} className="w-full justify-between">
                                    {filterProduct ? allProducts.find((p) => p.id === filterProduct)?.name : "Seleccionar producto..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar producto..." />
                                    <CommandEmpty>No se encontró el producto.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem key="all-products" onSelect={() => { setFilterProduct(''); setProductComboboxOpen(false); }}>
                                            <Check className={cn("mr-2 h-4 w-4", filterProduct === '' ? "opacity-100" : "opacity-0")} />
                                            Todos los productos
                                        </CommandItem>
                                        {allProducts.map((p) => (
                                            <CommandItem key={p.id} value={p.name} onSelect={() => { setFilterProduct(p.id === filterProduct ? '' : p.id); setProductComboboxOpen(false); }}>
                                                <Check className={cn("mr-2 h-4 w-4", filterProduct === p.id ? "opacity-100" : "opacity-0")} />
                                                {p.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardContent>
        </Card>


      {loading ? (
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
         </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productos Despachados</CardTitle>
                <PackageCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{filteredData.totalItemsDispatched}</div>
                <p className="text-xs text-muted-foreground">
                    Total de unidades despachadas en el período.
                </p>
                <div className="h-32 mt-4">
                    <DashboardOrdersChart data={filteredData.chartData} />
                </div>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Despachos Pendientes/Parciales</CardTitle>
                <PackageX className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{filteredData.totalPendingOrders}</div>
                <p className="text-xs text-muted-foreground">Órdenes en espera de procesamiento en el período.</p>
                 <div className="h-32 mt-4">
                    <DashboardPendingChart data={filteredData.pendingChartData} />
                </div>
            </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Devoluciones Recibidas</CardTitle>
                    <CornerDownLeft className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{filteredData.totalReturns}</div>
                    <p className="text-xs text-muted-foreground">
                        Total de productos retornados en el período.
                    </p>
                    <div className="h-32 mt-4">
                        <DashboardReturnsChart data={filteredData.returnsChartData} />
                    </div>
                </CardContent>
            </Card>
        </div>
      )}

        <Card>
            <CardHeader>
                <CardTitle>Rendimiento por Producto</CardTitle>
                <CardDescription>
                    Top 20 productos más vendidos en el período seleccionado.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-64" /> : filteredData.productChartData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="h-64">
                            <DashboardCategoryChart data={filteredData.productChartData.slice(0, 20)} />
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead className="text-right">Unidades</TableHead>
                                        <TableHead className="w-32 text-right">% del Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.productChartData.slice(0, 20).map(prod => (
                                        <TableRow key={prod.name}>
                                            <TableCell className="font-medium">{prod.name}</TableCell>
                                            <TableCell className="text-right">{prod.value}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-xs">{prod.percentage.toFixed(1)}%</span>
                                                    <Progress value={prod.percentage} className="h-2 w-16" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground py-16">
                        No hay datos de ventas por producto en el período seleccionado.
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Rendimiento por Categoría</CardTitle>
                <CardDescription>
                    Distribución de los productos vendidos por categoría en el período seleccionado.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-64" /> : filteredData.categoryChartData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="h-64">
                            <DashboardCategoryChart data={filteredData.categoryChartData} />
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Categoría</TableHead>
                                        <TableHead className="text-right">Unidades</TableHead>
                                        <TableHead className="w-32 text-right">% del Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.categoryChartData.map(cat => (
                                        <TableRow key={cat.name}>
                                            <TableCell className="font-medium">{cat.name}</TableCell>
                                            <TableCell className="text-right">{cat.value}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-xs">{cat.percentage.toFixed(1)}%</span>
                                                    <Progress value={cat.percentage} className="h-2 w-16" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground py-16">
                        No hay datos de ventas por categoría en el período seleccionado.
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Análisis de Distribución: Plataforma vs. Transportadora</CardTitle>
                <CardDescription>
                    Distribución porcentual de las transportadoras utilizadas por cada plataforma de venta.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-80" /> : filteredData.platformCarrierChartData.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                        <div className="lg:col-span-2 h-80">
                           <DashboardPlatformCarrierChart 
                                data={filteredData.platformCarrierChartData} 
                                carriers={filteredData.allCarrierNames}
                            />
                        </div>
                         <div className="lg:col-span-1 space-y-4 text-center lg:text-left">
                            <h4 className="font-semibold text-lg">Resumen Técnico</h4>
                            <div className="text-sm text-muted-foreground space-y-4">
                                <div>
                                    <p>La transportadora más usada en el período es: </p>
                                    <strong className="block text-xl text-foreground">
                                        {filteredData.mostUsedCarrier.name}
                                    </strong>
                                    <p className="text-xs">
                                        con {filteredData.mostUsedCarrier.count} productos ({filteredData.mostUsedCarrier.percentage.toFixed(1)}% del total).
                                    </p>
                                </div>
                                <div>
                                    <p>La plataforma con más despachos es: </p>
                                    <strong className="block text-xl text-foreground">
                                        {filteredData.platformWithMostOrders.name}
                                    </strong>
                                     <p className="text-xs">
                                        con {filteredData.platformWithMostOrders.count} órdenes ({filteredData.platformWithMostOrders.percentage.toFixed(1)}% del total).
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground py-16">
                        No hay datos de despachos en el período seleccionado.
                    </div>
                )}
            </CardContent>
        </Card>

    </div>
  );
}
