
"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDispatchOrders, getProducts } from '@/lib/api';
import type { DispatchOrder, Product } from '@/lib/types';
import { CalendarIcon, PackageCheck, PackageX, AlertTriangle } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import DashboardOrdersChart from '@/components/dashboard-orders-chart';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });
  const [allOrders, setAllOrders] = useState<DispatchOrder[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [orders, products] = await Promise.all([getDispatchOrders(), getProducts()]);
      setAllOrders(orders);
      setAllProducts(products);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    const fromDate = dateRange?.from ? startOfDay(dateRange.from) : new Date(0);
    const toDate = dateRange?.to ? endOfDay(dateRange.to) : new Date();

    const ordersInPeriod = allOrders.filter(order => {
      const orderDate = new Date(order.date);
      return orderDate >= fromDate && orderDate <= toDate;
    });

    const totalPendingStock = allProducts.reduce((sum, p) => sum + (p.pendingStock || 0), 0);
    const totalDamagedStock = allProducts.reduce((sum, p) => sum + (p.damagedStock || 0), 0);

    const ordersByDay = ordersInPeriod.reduce((acc, order) => {
        const day = format(new Date(order.date), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const chartData = [];
    let currentDate = new Date(fromDate);
    while (currentDate <= toDate) {
        const dayKey = format(currentDate, 'yyyy-MM-dd');
        chartData.push({
            date: dayKey,
            orders: ordersByDay[dayKey] || 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    

    return {
      ordersInPeriod,
      totalPendingStock,
      totalDamagedStock,
      chartData,
    };
  }, [dateRange, allOrders, allProducts]);

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

      {loading ? (
         <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
         </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-1 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Órdenes Movilizadas</CardTitle>
                <PackageCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{filteredData.ordersInPeriod.length}</div>
                <p className="text-xs text-muted-foreground">
                    Total de despachos generados en el período.
                </p>
                <div className="h-24 mt-4">
                    <DashboardOrdersChart data={filteredData.chartData} />
                </div>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productos Pendientes</CardTitle>
                <PackageX className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{filteredData.totalPendingStock}</div>
                <p className="text-xs text-muted-foreground">Unidades totales esperando resolución.</p>
            </CardContent>
            </Card>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productos en Avería</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{filteredData.totalDamagedStock}</div>
                <p className="text-xs text-muted-foreground">Unidades totales no aptas para la venta.</p>
            </CardContent>
            </Card>
        </div>
      )}

      {/* Remove previous content */}
    </div>
  );
}
