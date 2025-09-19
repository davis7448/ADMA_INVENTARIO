

"use client";

import { useState, useTransition, useMemo } from 'react';
import type { StockAlertItem } from '@/lib/types';
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
import { Skeleton } from './ui/skeleton';
import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { formatToTimeZone } from '@/lib/utils';
import { Button } from './ui/button';
import { regenerateStockAlertsAction } from '@/app/actions/stock-alerts';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';


interface StockAlertsContentProps {
    initialAlerts: StockAlertItem[];
    error?: string;
    lastGenerated?: string;
}

export function StockAlertsContent({ initialAlerts, error, lastGenerated }: StockAlertsContentProps) {
  const [alerts, setAlerts] = useState<StockAlertItem[]>(initialAlerts);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [hideNoSales, setHideNoSales] = useState(false);

  const handleRegenerate = () => {
    startTransition(async () => {
        const result = await regenerateStockAlertsAction();
        if (result.success) {
            toast({
                title: "¡Éxito!",
                description: result.message,
            });
            // This will cause a page refresh and get new initial props
        } else {
            toast({
                title: "Error",
                description: result.message,
                variant: "destructive",
            });
        }
    });
  }

  const filteredAlerts = useMemo(() => {
    if (hideNoSales) {
        return alerts.filter(alert => alert.dailyAverageSales > 0);
    }
    return alerts;
  }, [alerts, hideNoSales]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Alertas de Disponibilidad de Stock</h1>
        <p className="text-muted-foreground">
            Productos cuyo stock disponible para reservar es peligrosamente bajo en comparación con su demanda.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error al Generar Alertas</AlertTitle>
            <AlertDescription>
                No se pudieron generar nuevas alertas desde la IA. Los datos mostrados (si los hay) pueden ser de una ejecución anterior.
                <p className="mt-2 text-xs">{error}</p>
            </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Productos en Riesgo</CardTitle>
            <CardDescription>
              Estos productos podrían quedarse sin stock para nuevas reservas si no se toman acciones. 
              <br className="hidden sm:inline" />
              La alerta se activa si el stock disponible es menor a 3 días de ventas promedio.
            </CardDescription>
              {lastGenerated && (
                  <div className="text-xs text-muted-foreground pt-2">
                      Última actualización: {formatToTimeZone(new Date(lastGenerated), 'dd/MM/yyyy HH:mm:ss')}
                  </div>
              )}
          </div>
           <Button onClick={handleRegenerate} disabled={isPending} variant="outline">
                <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                {isPending ? 'Verificando...' : 'Forzar Verificación'}
            </Button>
        </CardHeader>
        <CardContent>
            <div className="flex items-center space-x-2 mb-4 p-4 border rounded-lg bg-muted/50">
                <Switch id="hide-no-sales" checked={hideNoSales} onCheckedChange={setHideNoSales} />
                <Label htmlFor="hide-no-sales">Ocultar productos sin ventas</Label>
            </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Mensaje de la IA</TableHead>
                <TableHead className="text-center">Stock Físico</TableHead>
                <TableHead className="text-center">Reservado</TableHead>
                <TableHead className="text-center">Disponible</TableHead>
                <TableHead className="text-center">Venta Diaria Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                ))
              ) : filteredAlerts.length > 0 ? (
                filteredAlerts.map((item) => (
                  <TableRow key={item.id} className="hover:bg-destructive/5">
                    <TableCell>
                        <div className="flex items-center gap-4">
                            <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded-md" />
                            <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{item.sku}</div>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-start gap-2">
                           <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                            <p className="text-sm">{item.alertMessage}</p>
                        </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">{item.physicalStock}</TableCell>
                    <TableCell className="text-center font-medium text-blue-600">{item.reservedStock}</TableCell>
                    <TableCell className="text-center font-bold text-destructive">{item.availableForSale}</TableCell>
                     <TableCell className="text-center font-medium text-amber-600">{item.dailyAverageSales.toFixed(1)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    {!error ? "¡No hay alertas de stock para los filtros seleccionados!" : "No hay datos de alertas disponibles."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
