
"use client";

import { useState, useTransition } from 'react';
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

interface StaleReservationsContentProps {
    initialAlerts: StaleReservationAlert[];
}

export function StaleReservationsContent({ initialAlerts }: StaleReservationsContentProps) {
  const [alerts, setAlerts] = useState<StaleReservationAlert[]>(initialAlerts);
  const [loading, setLoading] = useState(false);
  const [isResolving, startTransition] = useTransition();
  const { toast } = useToast();
  
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
              ) : alerts.length > 0 ? (
                alerts.map((alert) => (
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
      </Card>
    </div>
  );
}
