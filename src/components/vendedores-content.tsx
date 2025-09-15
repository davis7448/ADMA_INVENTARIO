
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
import { getVendedores } from '@/lib/api';
import type { Vendedor } from '@/lib/types';
import { AddVendedorForm } from '@/components/add-vendedor-form';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

interface VendedoresContentProps {
    initialVendedores: Vendedor[];
}

export function VendedoresContent({ initialVendedores }: VendedoresContentProps) {
    const [vendedores, setVendedores] = useState<Vendedor[]>(initialVendedores);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    const refreshVendedores = async () => {
        setLoading(true);
        const fetchedVendedores = await getVendedores();
        setVendedores(fetchedVendedores);
        setLoading(false);
    }
    
    const canEdit = user?.role === 'admin';

    return (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Vendedores</h1>
              <p className="text-muted-foreground">Gestiona tu lista de vendedores.</p>
            </div>
            {canEdit && <AddVendedorForm onVendedorAdded={refreshVendedores} />}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Todos los Vendedores</CardTitle>
              <CardDescription>Una lista de todos los vendedores registrados.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                     Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-60" /></TableCell>
                        </TableRow>
                     ))
                  ) : (
                    vendedores.map((vendedor) => (
                        <TableRow key={vendedor.id}>
                            <TableCell className="font-medium">{vendedor.name}</TableCell>
                            <TableCell>
                              <div>{vendedor.contact.email}</div>
                              <div className="text-sm text-muted-foreground">{vendedor.contact.phone}</div>
                            </TableCell>
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
