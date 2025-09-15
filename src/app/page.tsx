
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
import { getDispatchOrders, getProducts, getCarriers, getCategories, getInventoryMovements } from '@/lib/api';
import type { DispatchOrder, Product, Carrier, Category, InventoryMovement } from '@/lib/types';
import { CalendarIcon, PackageCheck, PackageX, CornerDownLeft } from 'lucide-react';
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


export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 6),
    to: new Date(),
  });
  const [allOrders, setAllOrders] = useState<DispatchOrder[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCarriers, setAllCarriers] = useState<Carrier[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allMovements, setAllMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [orders, products, carriers, categories, movements] = await Promise.all([
          getDispatchOrders(), 
          getProducts(), 
          getCarriers(),
          getCategories(),
          getInventoryMovements() // Fetch all movements
        ]);
      setAllOrders(orders);
      setAllProducts(products);
      setAllCarriers(carriers);
      setAllCategories(categories);
      setAllMovements(movements);
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

    const returnMovementsInPeriod = allMovements.filter(m => {
        const movementDate = new Date(m.date);
        const isReturn = m.type === 'Entrada' && (m.notes.toLowerCase().includes('devolución') || m.notes.toLowerCase().includes('averia'));
        return isReturn && movementDate >= fromDate && movementDate <= toDate;
    });
    const totalReturns = returnMovementsInPeriod.reduce((sum, m) => sum + m.quantity, 0);

    const returnsByDay = returnMovementsInPeriod.reduce((acc, m) => {
        const day = format(new Date(m.date), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + m.quantity;
        return acc;
    }, {} as Record<string, number>);

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
            percentage: totalItemsSold > 0 ? (count / totalItemsSold) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value);


    return {
      ordersInPeriod,
      totalPendingOrders,
      totalReturns,
      returnsChartData,
      pendingChartData,
      chartData,
      categoryChartData,
    };
  }, [dateRange, allOrders, allCarriers, allProducts, allCategories, allMovements]);

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

    </div>
  );
}

    