"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { getDashboardData, getCarriers, getCategories, getPlatforms } from '@/lib/api';
import type { DashboardData } from '@/lib/types';
import type { Carrier, Category, Platform } from '@/lib/types';
import { CalendarIcon, PlusCircle, Check, X } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { formatToTimeZone } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { addDays, format, startOfDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import React from 'react';
import DailyDispatchSummary from '@/components/daily-dispatch-summary';
import { es } from 'date-fns/locale';
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
    dailyProductDispatch: {},
};

function ReporteDespachosContent() {
  const searchParams = useSearchParams();
  const { user, effectiveWarehouseId: authEffectiveWarehouseId } = useAuth();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const to = new Date();
    const from = addDays(to, -6);
    return { from, to };
  });

  const [dashboardData, setDashboardData] = useState<DashboardData>(SKELETON_DASHBOARD_DATA);
  const [loading, setLoading] = useState(true);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);

  // Filter states
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [filterCarriers, setFilterCarriers] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);

  // Static filter options
  const [allCarriers, setAllCarriers] = useState<Carrier[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allPlatforms, setAllPlatforms] = useState<Platform[]>([]);
  const [allWarehouses, setAllWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>(searchParams.get('warehouse') || undefined);

  const effectiveWarehouseId = user?.role === 'admin' ? selectedWarehouse : authEffectiveWarehouseId;
  const warehouseId = searchParams.get('warehouse') || effectiveWarehouseId || undefined;

  // Debug logging for warehouse filtering
  console.log('Reporte Despachos Auth Debug:', {
    user: user ? { id: user.id, role: user.role, warehouseId: user.warehouseId } : null,
    authEffectiveWarehouseId,
    selectedWarehouse,
    effectiveWarehouseId,
    warehouseId,
    searchParamsWarehouse: searchParams.get('warehouse')
  });

  // Debug logging
  console.log('Reporte Despachos Debug:', {
    userRole: user?.role,
    userWarehouseId: user?.warehouseId,
    searchParamsWarehouse: searchParams.get('warehouse'),
    effectiveWarehouseId,
    finalWarehouseId: warehouseId
  });

  useEffect(() => {
    // Fetch static filter options once - reduced limit for better performance
    setFilterOptionsLoading(true);
    Promise.all([
      getCarriers(),
      getCategories(),
      getPlatforms(),
      getWarehouses()
    ]).then(([carriers, categories, platforms, warehouses]) => {
      setAllCarriers(carriers);
      setAllCategories(categories);
      setAllPlatforms(platforms);
      setAllWarehouses(warehouses);
      setFilterOptionsLoading(false);
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
          productIds: [],
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
  }, [warehouseId, dateRange, filterPlatforms, filterCarriers, filterCategories]);

  const clearFilters = () => {
    setFilterPlatforms([]);
    setFilterCarriers([]);
    setFilterCategories([]);
  };

  const hasActiveFilters = useMemo(() =>
    filterPlatforms.length > 0 || filterCarriers.length > 0 || filterCategories.length > 0,
    [filterPlatforms, filterCarriers, filterCategories]
  );

  interface MultiSelectFilterProps<T extends { id: string; name: string }> {
    title: string;
    options: T[];
    selected: string[];
    onSelectedChange: (selected: string[]) => void;
  }

  const MultiSelectFilter = React.memo(<T extends { id: string; name: string }>({
    title,
    options,
    selected,
    onSelectedChange,
  }: MultiSelectFilterProps<T>) => {
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
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold font-headline tracking-tight">Reporte de Despachos</h1>
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
        {filterOptionsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <MultiSelectFilter title="Plataformas" options={allPlatforms} selected={filterPlatforms} onSelectedChange={setFilterPlatforms} />
              <MultiSelectFilter title="Transportadoras" options={allCarriers} selected={filterCarriers} onSelectedChange={setFilterCarriers} />
              <MultiSelectFilter title="Categorías" options={allCategories} selected={filterCategories} onSelectedChange={setFilterCategories} />

              {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters} className="text-sm">
                      <X className="mr-2 h-4 w-4" />
                      Limpiar Filtros
                  </Button>
              )}
          </div>
        )}
      </div>

      {loading ? null : (
        <DailyDispatchSummary data={dashboardData.dailyDispatchSummaryData} />
      )}

      {loading ? null : (
        <Card>
            <CardHeader>
                <CardTitle>Listado de Productos Despachados por Día - Updated</CardTitle>
                <CardDescription>
                    Productos netamente despachados por día (excluyendo anulaciones y pendientes).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full space-y-2">
                    {Object.entries(dashboardData.dailyProductDispatch || {})
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([day, products]) => {
                            const totalProductsForDay = Object.values(products).reduce((sum, p) => sum + p.quantity, 0);
                            return (
                                <AccordionItem value={day} key={day} className="border rounded-lg px-4">
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full">
                                            <span className="font-semibold text-lg capitalize">
                                                {formatToTimeZone(new Date(`${day}T00:00:00`), 'eeee, dd MMM yyyy', { locale: es })}
                                            </span>
                                            <Badge variant="secondary">{totalProductsForDay} Productos</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="pt-2">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Producto</TableHead>
                                                        <TableHead className="text-right">Cantidad</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {Object.entries(products)
                                                        .sort(([, a], [, b]) => b.quantity - a.quantity)
                                                        .map(([productId, { name, quantity }]) => (
                                                            <TableRow key={productId}>
                                                                <TableCell>{name}</TableCell>
                                                                <TableCell className="text-right">{quantity}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                </Accordion>
            </CardContent>
        </Card>
      )}

    </div>
  );
}

export default function ReporteDespachos() {
    return (
        <ReporteDespachosContent />
    );
}