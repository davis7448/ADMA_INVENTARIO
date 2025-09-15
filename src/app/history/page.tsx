
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
import { getInventoryMovements } from '@/lib/api';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import type { InventoryMovement } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface DispatchOrder {
  id: string;
  date: string;
  totalItems: number;
  platform: string;
  carrier: string;
  products: { name: string; quantity: number }[];
}

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== 'logistics' && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    async function fetchMovements() {
        setLoading(true);
        const fetchedMovements = await getInventoryMovements();
        setMovements(fetchedMovements);
        setLoading(false);
    }
    fetchMovements();
  }, []);
  
  const sortedMovements = useMemo(() => 
    [...movements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [movements]
  );

  const dispatchOrders = useMemo(() => {
    const dispatches: Record<string, DispatchOrder> = {};
    const salidaMovements = movements.filter(m => m.type === 'Salida' && m.notes.includes('Dispatch ID:'));
    
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
        
        dispatches[dispatchId].products.push({ name: m.productName, quantity: m.quantity });
        dispatches[dispatchId].totalItems += m.quantity;
    });

    return Object.values(dispatches).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements]);

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
                <CardTitle>Movimientos Recientes</CardTitle>
                <CardDescription>
                    Mostrando las últimas entradas y salidas de inventario.
                </CardDescription>
                </CardHeader>
                <CardContent>
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
                    ) : sortedMovements.length > 0 ? (
                        sortedMovements.map((movement) => (
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
                            No hay movimientos de inventario registrados.
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
                    <CardDescription>Un historial de todos los picking lists generados.</CardDescription>
                </CardHeader>
                <CardContent>
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
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Producto</TableHead>
                                                    <TableHead className="text-right">Cantidad</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {order.products.map((p, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell>{p.name}</TableCell>
                                                        <TableCell className="text-right">{p.quantity}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">
                            No se han generado órdenes de despacho.
                        </div>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
      </Tabs>
    </div>
  );
}
