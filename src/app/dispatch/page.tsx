
"use client";

import { useEffect, useState, useMemo } from 'react';
import { getPendingDispatchOrders, getProducts, getPlatforms, getCarriers, getPartialDispatchOrders } from '@/lib/api';
import type { DispatchOrder, Product, Platform, Carrier } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatToTimeZone } from '@/lib/utils';
import { ProcessDispatchDialog } from '@/components/process-dispatch-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function DispatchPageContent() {
  const [pendingOrders, setPendingOrders] = useState<DispatchOrder[]>([]);
  const [partialOrders, setPartialOrders] = useState<DispatchOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [fetchedPendingOrders, fetchedPartialOrders, fetchedProducts, fetchedPlatforms, fetchedCarriers] = await Promise.all([
      getPendingDispatchOrders(),
      getPartialDispatchOrders(),
      getProducts(),
      getPlatforms(),
      getCarriers(),
    ]);
    setPendingOrders(fetchedPendingOrders);
    setPartialOrders(fetchedPartialOrders);
    setProducts(fetchedProducts);
    setPlatforms(fetchedPlatforms);
    setCarriers(fetchedCarriers);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const platformNames = useMemo(() => 
    platforms.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>),
    [platforms]
  );

  const carrierNames = useMemo(() =>
    carriers.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>),
    [carriers]
  );
  
  const productsById = useMemo(() =>
    products.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>),
    [products]
  );

  const handleDispatchProcessed = () => {
    fetchData(); // Refresh both lists after an order is processed
  }

  const getStatusBadge = (status: 'Pendiente' | 'Despachada' | 'Parcial') => {
    switch (status) {
      case 'Pendiente':
        return <Badge variant="destructive">Pendiente</Badge>;
      case 'Despachada':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Despachada</Badge>;
      case 'Parcial':
        return <Badge variant="secondary">Parcial</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const renderOrdersTable = (orders: DispatchOrder[], isPartialTab = false) => {
    return (
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Despacho</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : orders.length > 0 ? (
                orders.map((order) => {
                  const productsForDialog = isPartialTab
                    ? order.exceptions.flatMap(ex =>
                        ex.products.map(p => ({
                          productId: p.productId,
                          name: productsById[p.productId]?.name || 'N/A',
                          sku: productsById[p.productId]?.sku || 'N/A',
                          quantity: p.quantity,
                        }))
                      )
                    : order.products;

                  const orderForDialog = { ...order, products: productsForDialog };
                  
                  return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.dispatchId}</TableCell>
                    <TableCell>{formatToTimeZone(new Date(order.date), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>{platformNames[order.platformId] || 'N/A'}</TableCell>
                    <TableCell>{carrierNames[order.carrierId] || 'N/A'}</TableCell>
                    <TableCell>{order.totalItems}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">
                        <ProcessDispatchDialog 
                            order={orderForDialog}
                            productsById={productsById}
                            onDispatchProcessed={handleDispatchProcessed}
                        >
                            <Button>{isPartialTab ? 'Procesar Pendientes' : 'Procesar Despacho'}</Button>
                        </ProcessDispatchDialog>
                    </TableCell>
                  </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24">
                    No hay órdenes {isPartialTab ? 'parciales' : 'pendientes'}.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Despacho de Guías</h1>
        <p className="text-muted-foreground">Gestiona y finaliza las órdenes de despacho pendientes y parciales.</p>
      </div>

      <Tabs defaultValue="pendientes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pendientes">Pendientes</TabsTrigger>
            <TabsTrigger value="parciales">Parciales</TabsTrigger>
        </TabsList>
        <TabsContent value="pendientes">
            <Card>
                <CardHeader>
                <CardTitle>Órdenes de Despacho Pendientes</CardTitle>
                <CardDescription>
                    Estas son las órdenes que han sido preparadas (picking) y están listas para la asignación de guías y envío final.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    {renderOrdersTable(pendingOrders)}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="parciales">
            <Card>
                <CardHeader>
                <CardTitle>Órdenes con Despacho Parcial</CardTitle>
                <CardDescription>
                    Estas órdenes tuvieron excepciones. Desde aquí puedes procesar el despacho de los productos que quedaron pendientes.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    {renderOrdersTable(partialOrders, true)}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DispatchPage() {
    return (
        <AuthProviderWrapper allowedRoles={['admin', 'logistics']}>
            <DispatchPageContent />
        </AuthProviderWrapper>
    )
}
