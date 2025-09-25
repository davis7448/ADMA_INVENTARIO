

"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
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
import { getDashboardData, getProducts, getCarriers, getCategories, getPlatforms } from '@/lib/api';
import type { DashboardData } from '@/lib/types';
import type { Product, Carrier, Category, Platform, ProductVariant } from '@/lib/types';
import { CalendarIcon, PackageCheck, PackageX, CornerDownLeft, Check, ChevronsUpDown, X, PlusCircle, ChevronDown, ArchiveX, Settings, Edit } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { addDays, format, startOfDay } from 'date-fns';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import React from 'react';
import DailyDispatchSummary from '@/components/daily-dispatch-summary';
import { es } from 'date-fns/locale';
import DashboardAnnulledChart from '@/components/dashboard-annulled-chart';
import DashboardAdjustChart from '@/components/dashboard-adjust-chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWarehouses } from '@/lib/api';

const SKELETON_DASHBOARD_DATA: DashboardData = {
    totalItemsDispatched: 0,
    totalAnnulledItems: 0,
    totalPendingUnits: 0,
    totalReturns: 0,
    totalAdjustIn: 0,
    totalAdjustOut: 0,
    chartData: [],
    pendingChartData: [],
    returnsChartData: [],
    annulledChartData: [],
    adjustInChartData: [],
    adjustOutChartData: [],
    productChartData: [],
    categoryChartData: [],
    platformCarrierChartData: [],
    allCarrierNames: [],
    mostUsedCarrier: { name: '', count: 0, percentage: 0 },
    platformWithMostOrders: { name: '', count: 0, percentage: 0 },
    dailyDispatchSummaryData: {},
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const to = new Date();
    const from = addDays(to, -6);
    return { from, to };
  });

  const [dashboardData, setDashboardData] = useState<DashboardData>(SKELETON_DASHBOARD_DATA);
  const [loading, setLoading] = useState(true);
  const [expandedDashboardRow, setExpandedDashboardRow] = useState<string | null>(null);

  // Filter states
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [filterCarriers, setFilterCarriers] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterProducts, setFilterProducts] = useState<string[]>([]);

  // Static filter options
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCarriers, setAllCarriers] = useState<Carrier[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allPlatforms, setAllPlatforms] = useState<Platform[]>([]);
  const [allWarehouses, setAllWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>(searchParams.get('warehouse') || undefined);

  const effectiveWarehouseId = user && user.role !== 'admin' ? user.warehouseId : selectedWarehouse;
  const warehouseId = searchParams.get('warehouse') || effectiveWarehouseId || undefined;

  // Debug logging
  console.log('Dashboard Debug:', {
    userRole: user?.role,
    userWarehouseId: user?.warehouseId,
    searchParamsWarehouse: searchParams.get('warehouse'),
    effectiveWarehouseId,
    finalWarehouseId: warehouseId
  });

  // Auto-redirect logistics users to their warehouse URL
  useEffect(() => {
    if (user?.role === 'logistics' && user.warehouseId && !searchParams.get('warehouse')) {
      router.push(`/?warehouse=${user.warehouseId}`);
    }
  }, [user, searchParams, router]);


  useEffect(() => {
    // Fetch static filter options once
    Promise.all([
      getProducts({ limit: 10000, filters: { warehouseId } }),
      getCarriers(),
      getCategories(),
      getPlatforms(),
      getWarehouses()
    ]).then(([productsResult, carriers, categories, platforms, warehouses]) => {
      setAllProducts(productsResult.products);
      setAllCarriers(carriers);
      setAllCategories(categories);
      setAllPlatforms(platforms);
      setAllWarehouses(warehouses);
    });
  }, [warehouseId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!dateRange?.from || !dateRange?.to) return;
      setLoading(true);
      try {
        const data = await getDashboardData({
          warehouseId,
          dateRange: { from: dateRange.from, to: dateRange.to },
          platformIds: filterPlatforms,
          carrierIds: filterCarriers,
          categoryIds: filterCategories,
          productIds: filterProducts,
        });
        setDashboardData(data);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setDashboardData(SKELETON_DASHBOARD_DATA); // Reset data on error
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [warehouseId, dateRange, filterPlatforms, filterCarriers, filterCategories, filterProducts]);
  
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
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <Select value={selectedWarehouse || ''} onValueChange={(value) => setSelectedWarehouse(value === 'all' ? undefined : value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Seleccionar bodega" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las bodegas</SelectItem>
                {allWarehouses.map(wh => (
                  <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
                                  {format(dateRange.from, "LLL dd, y", { locale: es })} -{" "}
                                  {format(dateRange.to, "LLL dd, y", { locale: es })}
                              </>
                          ) : (
                              format(dateRange.from, "LLL dd, y", { locale: es })
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
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
         </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productos Despachados (Neto)</CardTitle>
                <PackageCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{dashboardData.totalItemsDispatched}</div>
                <p className="text-xs text-muted-foreground">
                    Total de unidades despachadas menos anulaciones.
                </p>
                <div className="h-32 mt-4">
                    <DashboardOrdersChart data={dashboardData.chartData} />
                </div>
            </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Productos Anulados</CardTitle>
                    <ArchiveX className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{dashboardData.totalAnnulledItems}</div>
                    <p className="text-xs text-muted-foreground">
                        Unidades anuladas de despachos en el período.
                    </p>
                    <div className="h-32 mt-4">
                        <DashboardAnnulledChart data={dashboardData.annulledChartData} />
                    </div>
                </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unidades Pendientes (Excepción)</CardTitle>
                <PackageX className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{dashboardData.totalPendingUnits}</div>
                <p className="text-xs text-muted-foreground">Unidades en espera de procesamiento.</p>
                 <div className="h-32 mt-4">
                    <DashboardPendingChart data={dashboardData.pendingChartData} />
                </div>
            </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Devoluciones Recibidas</CardTitle>
                    <CornerDownLeft className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{dashboardData.totalReturns}</div>
                    <p className="text-xs text-muted-foreground">
                        Total de productos retornados en el período.
                    </p>
                    <div className="h-32 mt-4">
                        <DashboardReturnsChart data={dashboardData.returnsChartData} />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ajustes de Entrada</CardTitle>
                    <Settings className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{dashboardData.totalAdjustIn}</div>
                    <p className="text-xs text-muted-foreground">
                        Unidades sumadas por ajuste manual.
                    </p>
                    <div className="h-32 mt-4">
                        <DashboardAdjustChart data={dashboardData.adjustInChartData} color="hsl(var(--chart-3))" />
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ajustes de Salida</CardTitle>
                    <Edit className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{dashboardData.totalAdjustOut}</div>
                    <p className="text-xs text-muted-foreground">
                        Unidades restadas por ajuste manual.
                    </p>
                    <div className="h-32 mt-4">
                        <DashboardAdjustChart data={dashboardData.adjustOutChartData} color="hsl(var(--chart-4))" />
                    </div>
                </CardContent>
            </Card>
        </div>
      )}
      
      {loading ? null : (
        <DailyDispatchSummary data={dashboardData.dailyDispatchSummaryData} />
      )}

        <Card>
            <CardHeader>
                <CardTitle>Rendimiento por Producto</CardTitle>
                <CardDescription>
                    Top 20 productos más vendidos en el período seleccionado.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-64" /> : dashboardData.productChartData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="h-64">
                            <DashboardCategoryChart data={dashboardData.productChartData.slice(0, 20)} />
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
                                    {dashboardData.productChartData.slice(0, 20).map(prod => (
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
                {loading ? <Skeleton className="h-64" /> : dashboardData.categoryChartData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="h-64">
                            <DashboardCategoryChart data={dashboardData.categoryChartData} />
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
                                    {dashboardData.categoryChartData.map(cat => (
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
                {loading ? <Skeleton className="h-80" /> : dashboardData.platformCarrierChartData.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                        <div className="lg:col-span-2 h-80">
                           <DashboardPlatformCarrierChart 
                                data={dashboardData.platformCarrierChartData} 
                                carriers={dashboardData.allCarrierNames}
                            />
                        </div>
                         <div className="lg:col-span-1 space-y-4 text-center lg:text-left">
                            <h4 className="font-semibold text-lg">Resumen Técnico</h4>
                            <div className="text-sm text-muted-foreground space-y-4">
                                <div>
                                    <p>La transportadora más usada en el período es: </p>
                                    <strong className="block text-xl text-foreground">
                                        {dashboardData.mostUsedCarrier.name}
                                    </strong>
                                    <p className="text-xs">
                                        con {dashboardData.mostUsedCarrier.count} productos ({dashboardData.mostUsedCarrier.percentage.toFixed(1)}% del total).
                                    </p>
                                </div>
                                <div>
                                    <p>La plataforma con más despachos es: </p>
                                    <strong className="block text-xl text-foreground">
                                        {dashboardData.platformWithMostOrders.name}
                                    </strong>
                                     <p className="text-xs">
                                        con {dashboardData.platformWithMostOrders.count} órdenes ({dashboardData.platformWithMostOrders.percentage.toFixed(1)}% del total).
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
  
export default function DashboardPage() {
    return (
        <Suspense>
            <DashboardContent />
        </Suspense>
    )
}
