
"use client";

import { useState } from 'react';
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
import { getCarriers } from '@/lib/api';
import type { Carrier } from '@/lib/types';
import { AddCarrierForm } from '@/components/add-carrier-form';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

interface CarriersContentProps {
    initialCarriers: Carrier[];
}

export function CarriersContent({ initialCarriers }: CarriersContentProps) {
    const [carriers, setCarriers] = useState<Carrier[]>(initialCarriers);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    const refreshCarriers = async () => {
        setLoading(true);
        const fetchedCarriers = await getCarriers();
        setCarriers(fetchedCarriers);
        setLoading(false);
    }
    
    const canEdit = user?.role === 'admin';

    return (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Transportadoras</h1>
              <p className="text-muted-foreground">Gestiona tus transportadoras de envío.</p>
            </div>
            {canEdit && <AddCarrierForm onCarrierAdded={refreshCarriers} />}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Todas las Transportadoras</CardTitle>
              <CardDescription>Una lista de todas las transportadoras de envío disponibles.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                     Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        </TableRow>
                     ))
                  ) : (
                    carriers.map((carrier) => (
                        <TableRow key={carrier.id}>
                            <TableCell className="font-medium">{carrier.name}</TableCell>
                        </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
    )
}
