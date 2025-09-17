
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
import { Button } from '@/components/ui/button';
import { getSuppliers } from '@/lib/api';
import { useState } from 'react';
import type { Supplier } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { AddSupplierForm } from '@/components/add-supplier-form';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';

interface SuppliersContentProps {
    initialSuppliers: Supplier[];
}

export function SuppliersContent({ initialSuppliers }: SuppliersContentProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const refreshSuppliers = async () => {
    setLoading(true);
    const fetchedSuppliers = await getSuppliers();
    setSuppliers(fetchedSuppliers);
    setLoading(false);
  }

  const canEdit = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">Manage your relationships with suppliers.</p>
        </div>
        {canEdit && <AddSupplierForm onSupplierAdded={refreshSuppliers} />}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Supplier Directory</CardTitle>
          <CardDescription>A list of all your suppliers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Policies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({length: 3}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    </TableRow>
                ))
              ) : suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">
                    <div>{supplier.name}</div>
                    <Badge variant="secondary" className="mt-1 font-mono">{supplier.id}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>{supplier.contact.email}</div>
                    <div className="text-sm text-muted-foreground">{supplier.contact.phone}</div>
                  </TableCell>
                  <TableCell>{supplier.productCount || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                       <Button variant="link" className="p-0 h-auto">Shipping</Button>
                       <Button variant="link" className="p-0 h-auto">Returns</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
