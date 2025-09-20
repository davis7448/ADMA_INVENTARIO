

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
import type { DispatchOrder, Product, Carrier, Category, InventoryMovement, Platform, ProductVariant } from '@/lib/types';
import { CalendarIcon, PackageCheck, PackageX, CornerDownLeft, Check, ChevronsUpDown, X, PlusCircle, ChevronDown } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, formatToTimeZone } from '@/lib/utils';
import DashboardOrdersChart from '@/components/dashboard-orders-chart';
import DashboardPendingChart from '@/components/dashboard-pending-chart';
import { Skeleton } from '@/components/ui/skeleton';
import DashboardCategoryChart from '@/components/dashboard-category-chart';
import DashboardReturnsChart from '@/components/dashboard-returns-chart';
import { Progress } from '@/components/ui/progress';
import DashboardPlatformCarrierChart from '@/components/dashboard-platform-carrier-chart';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import React from 'react';
import DailyDispatchSummary from '@/components/daily-dispatch-summary';
import { es } from 'date-fns/locale';

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
  const [expandedDashboardRow, setExpandedDashboardRow] = useState<string | null>(null);


  // Filter states - now arrays for multi-select
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [filterCarriers, setFilterCarriers] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterProducts, setFilterProducts] = useState<string[]>([]);


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
  
  const handleToggleDashboardRow = (productId: string) => {
    setExpandedDashboardRow(prev => (prev === productId ? null : productId));
  };


  const clearFilters = () => {
    setFilterPlatforms([]);
    setFilterCarriers([]);
    setFilterCategories([]);
    setFilterProducts([]);
  };

  const hasActiveFilters = filterPlatforms.length > 0 || filterCarriers.length > 0 || filterCategories.length > 0 || filterProducts.length > 0;

  const filteredData = useMemo(() => {
    const fromDate = dateRange?.from ? startOfDay(dateRange.from) : new Date(0);
    const toDate = dateRange?.to ? endOfDay(dateRange.to) : new Date();

    const productIdsInCategory = filterCategories.length > 0 
        ? allProducts.filter(p => filterCategories.includes(p.categoryId)).map(p => p.id)
        : null;
    
    const platformNameMap = allPlatforms.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>);
    const carrierNameMap = allCarriers.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>);

    let ordersInPeriod = allOrders.filter(order => {
        if (!order.date) return false;
        const orderDate = new Date(order.date);
        if (isNaN(orderDate.getTime())) return false;

        const dateMatch = orderDate >= fromDate && orderDate <= toDate;
        
        const platformMatch = filterPlatforms.length === 0 || filterPlatforms.includes(order.platformId);
        const carrierMatch = filterCarriers.length === 0 || filterCarriers.includes(order.carrierId);
        
        let productMatch = true;
        if (filterProducts.length > 0) {
            productMatch = order.products.some(p => filterProducts.includes(p.productId));
        } else if (productIdsInCategory) {
            productMatch = order.products.some(p => productIdsInCategory.includes(p.productId));
        }

        return dateMatch && platformMatch && carrierMatch && productMatch;
    });

    const totalItemsDispatched = ordersInPeriod.reduce((sum, order) => sum + order.totalItems, 0);

    const pendingAndPartialInPeriod = ordersInPeriod.filter(
        order => order.status === 'Pendiente' || order.status === 'Parcial'
    );
    
    // Calculate total pending units in exceptions
    let totalPendingUnits = 0;
    const pendingUnitsByDay: Record<string, number> = {};
    pendingAndPartialInPeriod.forEach(order => {
        const day = formatToTimeZone(new Date(order.date), 'yyyy-MM-dd');
        let unitsInOrder = 0;
        if (order.status === 'Pendiente') {
            // For a 'Pendiente' order, all items are considered pending
            unitsInOrder = order.totalItems;
        } else if (order.status === 'Parcial' && order.exceptions) {
            // For a 'Parcial' order, only count items in exceptions
            unitsInOrder = order.exceptions.reduce((sum, ex) => 
                sum + ex.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
        }
        totalPendingUnits += unitsInOrder;
        pendingUnitsByDay[day] = (pendingUnitsByDay[day] || 0) + unitsInOrder;
    });


    const returnMovementsInPeriod = allMovements.filter(m => {
        if (!m.date) return false;
        const movementDate = new Date(m.date);
        if (isNaN(movementDate.getTime())) return false;

        const isReturn = m.type === 'Entrada' && (m.notes.toLowerCase().includes('devolución') || m.notes.toLowerCase().includes('averia'));
        if (!isReturn || !(movementDate >= fromDate && movementDate <= toDate)) {
            return false;
        }

        let productMatch = true;
        if (filterProducts.length > 0) {
            productMatch = filterProducts.includes(m.productId);
        } else if (productIdsInCategory) {
            productMatch = productIdsInCategory.includes(m.productId);
        }
        return productMatch;
    });

    const totalReturns = returnMovementsInPeriod.reduce((sum, m) => sum + m.quantity, 0);

    const returnsByDay = returnMovementsInPeriod.reduce((acc, m) => {
        const day = formatToTimeZone(new Date(m.date), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + m.quantity;
        return acc;
    }, {} as Record<string, number>);

    const ordersByDay = ordersInPeriod.reduce((acc, order) => {
        const day = formatToTimeZone(new Date(order.date), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + order.totalItems; // Aggregate by items now
        return acc;
    }, {} as Record<string, number>);

    const chartData = [];
    const pendingChartData = [];
    const returnsChartData = [];
    
    if (dateRange?.from && dateRange?.to) {
      let currentDate = new Date(dateRange.from);
      while (currentDate <= dateRange.to) {
          const dayKey = formatToTimeZone(currentDate, 'yyyy-MM-dd');
          chartData.push({
              date: dayKey,
              orders: ordersByDay[dayKey] || 0,
          });
          pendingChartData.push({
              date: dayKey,
              orders: pendingUnitsByDay[dayKey] || 0,
          });
          returnsChartData.push({
              date: dayKey,
              returns: returnsByDay[dayKey] || 0,
          });
          currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    
    const productInfoMap = allProducts.reduce((acc, product) => {
        acc[product.id] = product; // Store the full product object
        return acc;
      }, {} as Record<string, Product>);

    const categoryNameMap = allCategories.reduce((acc, category) => {
        acc[category.id] = category.name;
        return acc;
    }, {} as Record<string, string>);

    const salesByProduct: Record<string, { total: number; variants: Record<string, number> }> = {};
    const salesByCategory: Record<string, number> = {};
    let totalItemsSold = 0;

    ordersInPeriod.forEach(order => {
        order.products.forEach(p => {
            const product = productInfoMap[p.productId];
            if (!product) return;

            // Initialize if not present
            if (!salesByProduct[p.productId]) {
              salesByProduct[p.productId] = { total: 0, variants: {} };
            }

            // Aggregate by parent product
            salesByProduct[p.productId].total += p.quantity;

            // Aggregate by variant if applicable
            if (p.variantId) {
                if (!salesByProduct[p.productId].variants[p.variantId]) {
                    salesByProduct[p.productId].variants[p.variantId] = 0;
                }
                salesByProduct[p.productId].variants[p.variantId] += p.quantity;
            }

            // Aggregate by category
            if (product.categoryId) {
                salesByCategory[product.categoryId] = (salesByCategory[product.categoryId] || 0) + p.quantity;
            }
            totalItemsSold += p.quantity;
        });
    });

    const productChartData = Object.entries(salesByProduct)
        .map(([productId, salesData]) => {
            const product = productInfoMap[productId];
            const variantsWithSales = product.variants?.map(v => ({
                ...v,
                sales: salesData.variants[v.id] || 0
            })) || [];

            return {
                id: productId,
                name: product.name || 'Unknown',
                productType: product.productType,
                value: salesData.total,
                percentage: totalItemsSold > 0 ? (salesData.total / totalItemsSold) * 100 : 0,
                variants: variantsWithSales
            }
        })
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

    const dailyDispatchSummaryData: Record<string, Record<string, Record<string, number>>> = {};

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

        // New Daily Dispatch Summary logic
        const day = formatToTimeZone(new Date(order.date), 'yyyy-MM-dd');
        const guideCount = order.trackingNumbers?.length || 0;

        if (guideCount > 0) {
            if (!dailyDispatchSummaryData[day]) {
                dailyDispatchSummaryData[day] = {};
            }
            if (!dailyDispatchSummaryData[day][carrierName]) {
                dailyDispatchSummaryData[day][carrierName] = {};
            }
            dailyDispatchSummaryData[day][carrierName][platformName] = (dailyDispatchSummaryData[day][carrierName][platformName] || 0) + guideCount;
        }
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
      totalPendingUnits,
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
      dailyDispatchSummaryData,
    };
  }, [dateRange, allOrders, allCarriers, allProducts, allCategories, allPlatforms, allMovements, filterPlatforms, filterCarriers, filterCategories, filterProducts]);

  interface MultiSelectFilterProps<T extends { id: string; name: string }> {
    title: string;
    options: T[];
    selected: string[];
    onSelectedChange: (selected: string[]) => void;
  }
  
  function MultiSelectFilter<T extends { id: string; name: string }>({
    title,
    options,
    selected,
    onSelectedChange,
  }: MultiSelectFilterProps<T>) {
    const [open, setOpen] = useState(false);

    const handleSelect = (id: string) => {
      const isSelected = selected.includes(id);
      if (isSelected) {
        onSelectedChange(selected.filter((s) => s !== id));
      } else {
        onSelectedChange([...selected, id]);
      }
    };
  
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start font-normal">
            <PlusCircle className="mr-2 h-4 w-4" />
            {title}
            {selected.length > 0 && (
              <Badge variant="secondary" className="ml-auto rounded-sm px-2">
                {selected.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Buscar ${title.toLowerCase()}...`} />
            <CommandList>
              <CommandEmpty>No se encontraron resultados.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    onSelect={() => {
                        handleSelect(option.id);
                        setOpen(true);
                    }}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selected.includes(option.id)
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    <span>{option.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold font-headline tracking-tight">Dashboard Operativo</h1>
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                        "w-full sm:w-[260px] justify-start text-left font-normal",
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
                    locale={es}
                />
            </PopoverContent>
        </Popover>
      </div>

      <div className="p-4 border rounded-lg bg-muted/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <MultiSelectFilter title="Plataformas" options={allPlatforms} selected={filterPlatforms} onSelectedChange={setFilterPlatforms} />
            <MultiSelectFilter title="Transportadoras" options={allCarriers} selected={filterCarriers} onSelectedChange={setFilterCarriers} />
            <MultiSelectFilter title="Categorías" options={allCategories} selected={filterCategories} onSelectedChange={setFilterCategories} />
            <MultiSelectFilter title="Productos" options={allProducts} selected={filterProducts} onSelectedChange={setFilterProducts} />
            
            {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="text-sm">
                    <X className="mr-2 h-4 w-4" />
                    Limpiar Filtros
                </Button>
            )}
        </div>
      </div>


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
                <CardTitle className="text-sm font-medium">Unidades Pendientes (Excepción)</CardTitle>
                <PackageX className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{filteredData.totalPendingUnits}</div>
                <p className="text-xs text-muted-foreground">Unidades en espera de procesamiento.</p>
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
      
      {loading ? null : (
        <DailyDispatchSummary data={filteredData.dailyDispatchSummaryData} />
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
                                        <TableHead className="w-[50px] text-right pr-4"><span className="sr-only">Expand</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.productChartData.slice(0, 20).map(prod => (
                                        <React.Fragment key={prod.id}>
                                        <TableRow>
                                            <TableCell className="font-medium">{prod.name}</TableCell>
                                            <TableCell className="text-right">{prod.value}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-xs">{prod.percentage.toFixed(1)}%</span>
                                                    <Progress value={prod.percentage} className="h-2 w-16" />
                                                </div>
                                            </TableCell>
                                            <TableCell className="w-[50px] pr-4 text-right">
                                                {prod.productType === 'variable' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleToggleDashboardRow(prod.id);
                                                        }}
                                                      >
                                                        <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform duration-200", expandedDashboardRow === prod.id && "rotate-180")} />
                                                      </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                         {prod.productType === 'variable' && expandedDashboardRow === prod.id && (
                                            <TableRow className="bg-muted/20 hover:bg-muted/30">
                                                <TableCell colSpan={4}>
                                                    <div className="p-4">
                                                        <h4 className="font-semibold mb-2 ml-4 text-sm">Desglose de Ventas por Variante</h4>
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="hover:bg-transparent">
                                                                    <TableHead>Nombre</TableHead>
                                                                    <TableHead>SKU</TableHead>
                                                                    <TableHead className="text-right">Unidades Vendidas</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                            {prod.variants.map((variant) => (
                                                                <TableRow key={variant.id} className="border-b-0 hover:bg-transparent">
                                                                    <TableCell>{variant.name}</TableCell>
                                                                    <TableCell>{variant.sku}</TableCell>
                                                                    <TableCell className="text-right font-medium">{variant.sales}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        </React.Fragment>
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
