
"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getDispatchOrders, getProducts, getCarriers, getCategories } from '@/lib/api';
import type { DispatchOrder, Product, Carrier, Category } from '@/lib/types';
import { CalendarIcon, PackageCheck, PackageX, AlertTriangle, Percent } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import DashboardOrdersChart from '@/components/dashboard-orders-chart';
import DashboardPendingChart from '@/components/dashboard-pending-chart';
import { Skeleton } from '@/components/ui/skeleton';
import DashboardCategoryChart from '@/components/dashboard-category-chart';

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });
  const [allOrders, setAllOrders] = useState<DispatchOrder[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCarriers, setAllCarriers] = useState<Carrier[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [orders, products, carriers, categories] = await Promise.all([
          getDispatchOrders(), 
          getProducts(), 
          getCarriers(),
          getCategories()
        ]);
      setAllOrders(orders);
      setAllProducts(products);
      setAllCarriers(carriers);
      setAllCategories(categories);
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

    const pendingAndPartialInPeriod = ordersInPeriod.filter(
        order => order.status === 'Pendiente' || order.status === 'Parcial'
    );
    const totalPendingOrders = pendingAndPartialInPeriod.length;

    const ordersByDay = ordersInPeriod.reduce((acc, order) => {
        const day = format(new Date(order.date), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const pendingByDay: Record<string, number> = pendingAndPartialInPeriod.reduce((acc, order) => {
        const day = format(new Date(order.date), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {});


    const chartData = [];
    const pendingChartData = [];
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
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const productCategoryMap = allProducts.reduce((acc, product) => {
        acc[product.id] = product.categoryId;
        return acc;
    }, {} as Record<string, string>);

    const categoryNameMap = allCategories.reduce((acc, category) => {
        acc[category.id] = category.name;
        return acc;
    }, {} as Record<string, string>);

    const salesByCategory: Record<string, number> = {};
    let totalItemsSold = 0;

    ordersInPeriod.forEach(order => {
        order.products.forEach(product => {
            const categoryId = productCategoryMap[product.productId];
            if (categoryId) {
                salesByCategory[categoryId] = (salesByCategory[categoryId] || 0) + product.quantity;
            }
            totalItemsSold += product.quantity;
        });
    });

    const categoryChartData = Object.entries(salesByCategory)
        .map(([categoryId, count]) => ({
            name: categoryNameMap[categoryId] || 'Unknown',
            value: count,
        }))
        .sort((a, b) => b.value - a.value);

    const mostMovedCategory = categoryChartData[0] || null;
    const mostMovedCategoryPercentage = mostMovedCategory && totalItemsSold > 0
        ? (mostMovedCategory.value / totalItemsSold) * 100
        : 0;


    return {
      ordersInPeriod,
      totalPendingOrders,
      pendingChartData,
      chartData,
      categoryChartData,
      mostMovedCategory,
      mostMovedCategoryPercentage,
    };
  }, [dateRange, allOrders, allCarriers, allProducts, allCategories]);

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
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
         </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Órdenes Movilizadas</CardTitle>
                <PackageCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{filteredData.ordersInPeriod.length}</div>
                <p className="text-xs text-muted-foreground">
                    Total de despachos generados en el período.
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
            <Card className="flex flex-col">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Categoría Principal</CardTitle>
                    <CardDescription>
                        La categoría de productos más vendida en el período.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center">
                   {filteredData.mostMovedCategory ? (
                        <>
                            <div className="flex items-baseline gap-2 justify-center">
                               <p className="text-2xl font-bold">{filteredData.mostMovedCategory.name}</p>
                               <p className="text-sm font-semibold text-green-500">
                                   ({filteredData.mostMovedCategoryPercentage.toFixed(1)}%)
                               </p>
                            </div>
                            <div className="h-32 mt-2">
                                <DashboardCategoryChart data={filteredData.categoryChartData} />
                            </div>
                        </>
                   ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            No hay datos de ventas.
                        </div>
                   )}
                </CardContent>
            </Card>
        </div>
      )}

    </div>
  );
}
