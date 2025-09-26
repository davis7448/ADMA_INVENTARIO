"use client";

import { useState, useEffect, useTransition } from 'react';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getInventoryMovements, getDispatchOrders, getWarehouses, getCarriers } from '@/lib/api';
import { updateMovementWarehouseAction, updateOrderWarehouseAction, bulkUpdateMovementWarehousesAction, bulkUpdateOrderWarehousesAction } from '@/app/actions/warehouse-normalization';
import { useToast } from '@/hooks/use-toast';
import type { InventoryMovement, DispatchOrder, Warehouse } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function NormalizeWarehousesPage() {
  return (
    <AuthProviderWrapper allowedRoles={['admin']}>
      <NormalizeWarehousesContent />
    </AuthProviderWrapper>
  );
}

function NormalizeWarehousesContent() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [carriers, setCarriers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, startTransition] = useTransition();
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [movementsResult, ordersResult, warehousesResult, carriersResult] = await Promise.all([
          getInventoryMovements({ fetchAll: true }),
          getDispatchOrders({ fetchAll: true }),
          getWarehouses(),
          getCarriers()
        ]);

        // Filter movements and orders without warehouseId
        const movementsWithoutWarehouse = movementsResult.movements.filter(m => !m.warehouseId);
        const ordersWithoutWarehouse = ordersResult.orders.filter(o => !o.warehouseId);

        setMovements(movementsWithoutWarehouse);
        setOrders(ordersWithoutWarehouse);
        setWarehouses(warehousesResult);
        setCarriers(carriersResult);
        setSelectedMovements([]);
        setSelectedOrders([]);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const handleUpdateMovement = (movementId: string, warehouseId: string) => {
    startTransition(async () => {
      const result = await updateMovementWarehouseAction(movementId, warehouseId);
      if (result.success) {
        setMovements(prev => prev.filter(m => m.id !== movementId));
        setSelectedMovements(prev => prev.filter(id => id !== movementId));
        toast({
          title: 'Éxito',
          description: 'Bodega asignada al movimiento.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo asignar la bodega.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleUpdateOrder = (orderId: string, warehouseId: string) => {
    startTransition(async () => {
      const result = await updateOrderWarehouseAction(orderId, warehouseId);
      if (result.success) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        setSelectedOrders(prev => prev.filter(id => id !== orderId));
        toast({
          title: 'Éxito',
          description: 'Bodega asignada a la orden.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo asignar la bodega.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleSelectMovement = (movementId: string, checked: boolean) => {
    setSelectedMovements(prev =>
      checked
        ? [...prev, movementId]
        : prev.filter(id => id !== movementId)
    );
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrders(prev =>
      checked
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    );
  };

  const handleSelectAllMovements = (checked: boolean) => {
    setSelectedMovements(checked ? movements.map(m => m.id) : []);
  };

  const handleSelectAllOrders = (checked: boolean) => {
    setSelectedOrders(checked ? orders.map(o => o.id) : []);
  };

  const handleBulkUpdateMovements = (warehouseId: string) => {
    if (selectedMovements.length === 0) return;

    startTransition(async () => {
      const result = await bulkUpdateMovementWarehousesAction(selectedMovements, warehouseId);
      if (result.success) {
        setMovements(prev => prev.filter(m => !selectedMovements.includes(m.id)));
        setSelectedMovements([]);
        toast({
          title: 'Éxito',
          description: `${result.successful} de ${result.total} movimientos actualizados.`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudieron actualizar los movimientos.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleBulkUpdateOrders = (warehouseId: string) => {
    if (selectedOrders.length === 0) return;

    startTransition(async () => {
      const result = await bulkUpdateOrderWarehousesAction(selectedOrders, warehouseId);
      if (result.success) {
        setOrders(prev => prev.filter(o => !selectedOrders.includes(o.id)));
        setSelectedOrders([]);
        toast({
          title: 'Éxito',
          description: `${result.successful} de ${result.total} órdenes actualizadas.`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudieron actualizar las órdenes.',
          variant: 'destructive',
        });
      }
    });
  };

  const getMovementTypeBadge = (type: InventoryMovement['type']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'Entrada': 'default',
      'Salida': 'secondary',
      'Ajuste de Entrada': 'outline',
      'Ajuste de Salida': 'destructive',
    };
    return <Badge variant={variants[type] || 'default'}>{type}</Badge>;
  };

  const getOrderStatusBadge = (status: DispatchOrder['status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'Pendiente': 'secondary',
      'Despachada': 'default',
      'Parcial': 'outline',
      'Anulada': 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const carrierMap = carriers.reduce((acc, carrier) => {
    acc[carrier.id] = carrier.name;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Normalizar Bodegas</h1>
        <p className="text-muted-foreground">
          Asigna bodegas a movimientos de inventario y órdenes de despacho que no tienen una asignada.
        </p>
      </div>

      <Tabs defaultValue="movements" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="movements">
            Movimientos de Inventario ({movements.length})
          </TabsTrigger>
          <TabsTrigger value="orders">
            Órdenes de Despacho ({orders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle>Movimientos sin Bodega Asignada</CardTitle>
            </CardHeader>
            {selectedMovements.length > 0 && (
              <div className="px-6 py-4 border-b bg-muted/50">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    {selectedMovements.length} movimiento{selectedMovements.length !== 1 ? 's' : ''} seleccionado{selectedMovements.length !== 1 ? 's' : ''}
                  </span>
                  <Select onValueChange={handleBulkUpdateMovements} disabled={updating}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Asignar bodega" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMovements([])}
                    disabled={updating}
                  >
                    Limpiar selección
                  </Button>
                </div>
              </div>
            )}
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : movements.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No hay movimientos de inventario sin bodega asignada.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedMovements.length === movements.length && movements.length > 0}
                          onCheckedChange={handleSelectAllMovements}
                          disabled={updating}
                        />
                      </TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Bodega</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedMovements.includes(movement.id)}
                            onCheckedChange={(checked) => handleSelectMovement(movement.id, checked as boolean)}
                            disabled={updating}
                          />
                        </TableCell>
                        <TableCell>
                          {format(movement.date, 'dd/MM/yyyy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell>{getMovementTypeBadge(movement.type)}</TableCell>
                        <TableCell>{movement.productName}</TableCell>
                        <TableCell>{movement.quantity}</TableCell>
                        <TableCell className="max-w-xs truncate">{movement.notes}</TableCell>
                        <TableCell>
                          <Select
                            onValueChange={(warehouseId) => handleUpdateMovement(movement.id, warehouseId)}
                            disabled={updating}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Seleccionar bodega" />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses.map((wh) => (
                                <SelectItem key={wh.id} value={wh.id}>
                                  {wh.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes sin Bodega Asignada</CardTitle>
            </CardHeader>
            {selectedOrders.length > 0 && (
              <div className="px-6 py-4 border-b bg-muted/50">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    {selectedOrders.length} orden{selectedOrders.length !== 1 ? 'es' : ''} seleccionada{selectedOrders.length !== 1 ? 's' : ''}
                  </span>
                  <Select onValueChange={handleBulkUpdateOrders} disabled={updating}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Asignar bodega" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedOrders([])}
                    disabled={updating}
                  >
                    Limpiar selección
                  </Button>
                </div>
              </div>
            )}
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No hay órdenes de despacho sin bodega asignada.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedOrders.length === orders.length && orders.length > 0}
                          onCheckedChange={handleSelectAllOrders}
                          disabled={updating}
                        />
                      </TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Productos</TableHead>
                      <TableHead>Transportadora</TableHead>
                      <TableHead>Bodega</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                            disabled={updating}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{order.dispatchId}</TableCell>
                        <TableCell>
                          {format(order.date, 'dd/MM/yyyy HH:mm', { locale: es })}
                        </TableCell>
                        <TableCell>{getOrderStatusBadge(order.status)}</TableCell>
                        <TableCell>{order.totalItems} productos</TableCell>
                        <TableCell>{carrierMap[order.carrierId] || order.carrierId}</TableCell>
                        <TableCell>
                          <Select
                            onValueChange={(warehouseId) => handleUpdateOrder(order.id, warehouseId)}
                            disabled={updating}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Seleccionar bodega" />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses.map((wh) => (
                                <SelectItem key={wh.id} value={wh.id}>
                                  {wh.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}