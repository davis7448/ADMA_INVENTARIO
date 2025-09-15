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
import { DollarSign, Archive, Package, Truck, AlertTriangle } from 'lucide-react';
import { getProducts, getSuppliers, getInventoryMovements, getDispatchOrders, getCarriers } from '@/lib/api';
import type { Product, InventoryMovement, DispatchOrder, Carrier } from '@/lib/types';
import { formatToTimeZone } from '@/lib/utils';
import InventoryChart from '@/components/inventory-chart';
import CarrierChart from '@/components/carrier-chart';
import ReturnsChart from '@/components/returns-chart';
import { subDays, format, startOfDay } from 'date-fns';

export default async function DashboardPage() {
  const [products, suppliers, movements, dispatchOrders, carriers] = await Promise.all([
    getProducts(),
    getSuppliers(),
    getInventoryMovements(),
    getDispatchOrders(),
    getCarriers(),
  ]);

  const totalInventoryValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
  const lowStockProducts = products.filter(p => p.stock < p.restockThreshold).length;
  const recentMovements = movements
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const topProductsByStock = [...products]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5)
    .map(p => ({ name: p.name, stock: p.stock }));

  const carrierNamesById = carriers.reduce((acc, carrier) => {
    acc[carrier.id] = carrier.name;
    return acc;
  }, {} as Record<string, string>);

  const dispatchesByCarrier = dispatchOrders.reduce((acc, order) => {
    const carrierName = carrierNamesById[order.carrierId] || 'Unknown';
    acc[carrierName] = (acc[carrierName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const carrierChartData = Object.entries(dispatchesByCarrier).map(([name, value]) => ({ name, value }));

  const thirtyDaysAgo = subDays(new Date(), 30);
  const returnMovements = movements.filter(m => 
      m.type === 'Entrada' && 
      m.notes.toLowerCase().includes('devolución') &&
      new Date(m.date) >= thirtyDaysAgo
  );

  const returnsByDay = returnMovements.reduce((acc, m) => {
    const day = format(startOfDay(new Date(m.date)), 'yyyy-MM-dd');
    acc[day] = (acc[day] || 0) + m.quantity;
    return acc;
  }, {} as Record<string, number>);

  const returnsChartData = Array.from({ length: 30 }).map((_, i) => {
    const date = subDays(new Date(), i);
    const dayKey = format(startOfDay(date), 'yyyy-MM-dd');
    return {
      date: dayKey,
      returns: returnsByDay[dayKey] || 0,
    };
  }).reverse();
    
  const getBadgeClass = (type: 'Entrada' | 'Salida' | 'Averia') => {
    switch (type) {
      case 'Entrada':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'Salida':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'Averia':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total del Inventario</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Valor total de todos los productos en stock.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos con Bajo Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts}</div>
            <p className="text-xs text-muted-foreground">Productos que necesitan reposición.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Productos</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">SKUs únicos en el catálogo.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Proveedores</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground">Proveedores activos registrados.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Distribución por Transportadora</CardTitle>
            <CardDescription>Volumen de despachos por cada transportadora.</CardDescription>
          </CardHeader>
          <CardContent>
            <CarrierChart data={carrierChartData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Tendencia de Devoluciones</CardTitle>
            <CardDescription>Volumen de devoluciones en los últimos 30 días.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReturnsChart data={returnsChartData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline">Top 5 Productos por Stock</CardTitle>
            <CardDescription>Visualización de los productos con más unidades en inventario.</CardDescription>
          </CardHeader>
          <CardContent>
            <InventoryChart data={topProductsByStock} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Movimientos Recientes</CardTitle>
            <CardDescription>Últimas 5 entradas y salidas de inventario.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      <div className="font-medium">{movement.productName}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatToTimeZone(new Date(movement.date), "dd/MM/yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getBadgeClass(movement.type)}>
                        {movement.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{movement.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
