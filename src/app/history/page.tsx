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
import { useEffect, useState } from 'react';
import type { InventoryMovement } from '@/lib/types';

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  useEffect(() => {
    if (user && user.role !== 'logistics' && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    setMovements(getInventoryMovements());
  }, []);
  
  const sortedMovements = [...movements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
        <p className="text-muted-foreground">Un registro de todas las entradas y salidas de stock.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Movimientos Recientes</CardTitle>
          <CardDescription>
            Mostrando los últimos {sortedMovements.length} movimientos de inventario.
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
              {sortedMovements.length > 0 ? (
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
    </div>
  );
}
