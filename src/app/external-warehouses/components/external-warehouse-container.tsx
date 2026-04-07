"use client";

import { useEffect, useState, useCallback } from 'react';
import type { Warehouse, ExternalStockSnapshot } from '@/lib/types';
import { getExternalWarehousesAction, getSnapshotsAction } from '@/app/actions/external-warehouses';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalStockUploadDialog } from '@/components/external-stock-upload-dialog';
import { SnapshotHistory } from './snapshot-history';
import { RotationSummary } from './rotation-summary';
import { MappingManagement } from './mapping-management';
import { Upload, Warehouse as WarehouseIcon } from 'lucide-react';
import Link from 'next/link';

export function ExternalWarehouseContainer() {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [snapshots, setSnapshots] = useState<ExternalStockSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId) ?? null;

  const loadWarehouses = useCallback(async () => {
    setLoadingWarehouses(true);
    const res = await getExternalWarehousesAction();
    if (res.success) {
      setWarehouses(res.warehouses);
      if (res.warehouses.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(res.warehouses[0].id);
      }
    }
    setLoadingWarehouses(false);
  }, [selectedWarehouseId]);

  const loadSnapshots = useCallback(async (warehouseId: string) => {
    setLoadingSnapshots(true);
    setSelectedSnapshotId(null);
    const res = await getSnapshotsAction(warehouseId);
    if (res.success) setSnapshots(res.snapshots);
    setLoadingSnapshots(false);
  }, []);

  useEffect(() => { loadWarehouses(); }, []);

  useEffect(() => {
    if (selectedWarehouseId) loadSnapshots(selectedWarehouseId);
  }, [selectedWarehouseId, loadSnapshots]);

  const handleUploadClose = (snapshotId?: string) => {
    setIsUploadOpen(false);
    if (selectedWarehouseId) {
      loadSnapshots(selectedWarehouseId).then(() => {
        if (snapshotId) setSelectedSnapshotId(snapshotId);
      });
    }
  };

  if (loadingWarehouses) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (warehouses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <WarehouseIcon className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">No hay bodegas externas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crea una bodega externa desde{' '}
              <Link href="/settings" className="text-primary underline underline-offset-2">
                Ajustes → Bodegas
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Warehouse selector + upload button */}
      <div className="flex items-center gap-3">
        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Seleccionar bodega externa..." />
          </SelectTrigger>
          <SelectContent>
            {warehouses.map(wh => (
              <SelectItem key={wh.id} value={wh.id}>
                {wh.name}
                {wh.externalProvider && (
                  <span className="text-muted-foreground ml-2">· {wh.externalProvider}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedWarehouse && (
          <Button
            onClick={() => setIsUploadOpen(true)}
            disabled={!selectedWarehouse.columnConfig}
            title={!selectedWarehouse.columnConfig ? 'Configura las columnas primero desde Ajustes → Bodegas' : undefined}
          >
            <Upload className="h-4 w-4 mr-2" />
            Cargar Excel
          </Button>
        )}

        {selectedWarehouse && !selectedWarehouse.columnConfig && (
          <p className="text-xs text-amber-600">
            Configura las columnas del Excel en{' '}
            <Link href="/settings" className="underline underline-offset-2">Ajustes → Bodegas</Link>
          </p>
        )}
      </div>

      {/* Tabs */}
      {selectedWarehouse && (
        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history">Historial de cargas</TabsTrigger>
            <TabsTrigger value="rotation" disabled={!selectedSnapshotId}>
              Rotación {selectedSnapshotId ? '' : '(selecciona una carga)'}
            </TabsTrigger>
            <TabsTrigger value="mappings">Mapeos</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historial de cargas</CardTitle>
                <CardDescription>
                  Cada vez que subes un Excel queda registrado aquí. Haz clic en "Rotación" para comparar con la carga anterior.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSnapshots ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : (
                  <SnapshotHistory
                    snapshots={snapshots}
                    selectedSnapshotId={selectedSnapshotId}
                    onSelectSnapshot={(id) => setSelectedSnapshotId(id)}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rotation">
            <Card>
              <CardHeader>
                <CardTitle>Rotación de inventario</CardTitle>
                <CardDescription>
                  Diferencias entre esta carga y la anterior. Muestra qué se vendió/removió y qué ingresó.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedSnapshotId ? (
                  <RotationSummary warehouseId={selectedWarehouseId} snapshotId={selectedSnapshotId} />
                ) : (
                  <p className="text-sm text-muted-foreground">Selecciona una carga del historial para ver la rotación.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mappings">
            <Card>
              <CardHeader>
                <CardTitle>Mapeos de productos</CardTitle>
                <CardDescription>
                  Tabla de equivalencias entre los IDs externos de esta bodega y tus SKUs internos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MappingManagement warehouseId={selectedWarehouseId} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Upload dialog */}
      {selectedWarehouse && isUploadOpen && user && (
        <ExternalStockUploadDialog
          warehouse={selectedWarehouse}
          open={isUploadOpen}
          uploadedBy={{ id: user.id, name: user.name }}
          onClose={handleUploadClose}
        />
      )}
    </div>
  );
}
