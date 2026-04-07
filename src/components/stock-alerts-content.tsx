

"use client";

import { useState, useTransition, useMemo } from 'react';
import type { StockAlertItem } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { AlertCircle, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { formatToTimeZone } from '@/lib/utils';
import { Button } from './ui/button';
import { regenerateStockAlertsAction } from '@/app/actions/stock-alerts';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';


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
  const { user } = useAuth();
  const router = useRouter();
  const [hideNoSales, setHideNoSales] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const canForceRegenerate = user?.role === 'admin' || user?.role === 'plataformas';

  const handleRegenerate = () => {
    startTransition(async () => {
        setLoading(true);
        const result = await regenerateStockAlertsAction();
        if (result.success) {
            toast({
                title: "¡Éxito!",
                description: result.message,
            });
            router.refresh();
        } else {
            toast({
                title: "Error",
                description: result.message,
                variant: "destructive",
            });
        }
        setLoading(false);
    });
  }

  const filteredAlerts = useMemo(() => {
    if (hideNoSales) {
        return alerts.filter(alert => alert.dailyAverageSales > 0);
    }
    return alerts;
  }, [alerts, hideNoSales]);

  const paginatedAlerts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAlerts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAlerts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage);

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
           {canForceRegenerate && (
            <Button onClick={handleRegenerate} disabled={isPending || loading} variant="outline">
                <RefreshCw className={`mr-2 h-4 w-4 ${(isPending || loading) ? 'animate-spin' : ''}`} />
                {(isPending || loading) ? 'Verificando...' : 'Forzar Verificación'}
            </Button>
           )}
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
              {(loading || isPending) ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                ))
              ) : paginatedAlerts.length > 0 ? (
                paginatedAlerts.map((item) => (
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
        <CardFooter>
            <div className="flex items-center justify-end space-x-6 lg:space-x-8 w-full">
                <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Filas por página</p>
                    <Select
                        value={`${itemsPerPage}`}
                        onValueChange={(value) => setItemsPerPage(Number(value))}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={itemsPerPage} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 20, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                                {pageSize}
                            </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                    Página {currentPage} de {totalPages > 0 ? totalPages : 1}
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        <span className="sr-only">Ir a la página anterior</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                    >
                        <span className="sr-only">Ir a la página siguiente</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}
