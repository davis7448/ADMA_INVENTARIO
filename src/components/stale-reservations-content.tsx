

"use client";

import { useState, useTransition, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { getStaleReservationAlerts, resolveStaleReservationAlert } from '@/lib/api';
import type { StaleReservationAlert } from '@/lib/types';
import { formatToTimeZone } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from './ui/skeleton';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StaleReservationsContentProps {
    initialAlerts: StaleReservationAlert[];
}

export function StaleReservationsContent({ initialAlerts }: StaleReservationsContentProps) {
  const [alerts, setAlerts] = useState<StaleReservationAlert[]>(initialAlerts);
  const [loading, setLoading] = useState(false);
  const [isResolving, startTransition] = useTransition();
  const { toast } = useToast();
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const paginatedAlerts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return alerts.slice(startIndex, startIndex + itemsPerPage);
  }, [alerts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(alerts.length / itemsPerPage);


  const refreshAlerts = async () => {
    setLoading(true);
    const fetchedAlerts = await getStaleReservationAlerts();
    setAlerts(fetchedAlerts);
    setLoading(false);
  }

  const handleResolveAlert = (alertId: string) => {
    startTransition(async () => {
        try {
            await resolveStaleReservationAlert(alertId);
            toast({
                title: "Reserva Liberada",
                description: "La reserva ha sido eliminada y el stock se ha liberado.",
            });
            refreshAlerts();
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo resolver la alerta. Por favor, inténtalo de nuevo.",
                variant: 'destructive',
            });
        }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Alertas de Reservas Inactivas</h1>
        <p className="text-muted-foreground">
            Reservas que tienen más de 5 días de antigüedad sin una salida de inventario correspondiente.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reservas Pendientes de Verificación</CardTitle>
          <CardDescription>
            Revisa estas reservas. Si ya no son válidas, puedes liberar el stock para que esté disponible para otros vendedores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Fecha Reserva</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Fecha Alerta</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                ))
              ) : paginatedAlerts.length > 0 ? (
                paginatedAlerts.map((alert) => (
                  <TableRow key={alert.id} className="hover:bg-amber-50 dark:hover:bg-amber-900/20">
                    <TableCell>
                      <div className="font-medium">{alert.productName}</div>
                      <div className="text-sm text-muted-foreground">{alert.productSku}</div>
                    </TableCell>
                    <TableCell>{alert.vendedorName}</TableCell>
                    <TableCell>{formatToTimeZone(new Date(alert.reservationDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-semibold text-center">{alert.quantity}</TableCell>
                    <TableCell className="text-destructive">{formatToTimeZone(new Date(alert.alertDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">Liberar Reserva</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Confirmar liberación?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción eliminará la reserva de forma permanente y liberará 
                                        <span className="font-bold"> {alert.quantity} unidad(es) </span>
                                        del producto 
                                        <span className="font-bold"> {alert.productName} </span>.
                                        Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                        onClick={() => handleResolveAlert(alert.id)}
                                        disabled={isResolving}
                                    >
                                        {isResolving ? "Liberando..." : "Confirmar y Liberar"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    ¡No hay alertas de reservas inactivas! Todo en orden.
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
