
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
import { getReturnRequests } from '@/lib/api';
import { WarrantyPolicyDialog } from '@/components/warranty-policy-dialog';
import type { ReturnRequest } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { Suspense } from 'react';

const statusStyles: { [key: string]: string } = {
  Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  Approved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

function GarantiasPageContent() {
  const returnRequests: ReturnRequest[] = getReturnRequests();
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Garantías</h1>
          <p className="text-muted-foreground">Procesa y gestiona las solicitudes de garantía de clientes.</p>
        </div>
        <WarrantyPolicyDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Solicitudes de Garantía</CardTitle>
          <CardDescription>Una lista de todas las solicitudes de garantía de los clientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Solicitud</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Razón</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returnRequests.length > 0 ? (
                returnRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.id}</TableCell>
                    <TableCell>{request.customerName}</TableCell>
                    <TableCell>{request.productName}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{request.reason}</TableCell>
                    <TableCell>{request.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusStyles[request.status]}>{request.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No se encontraron solicitudes de garantía.
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

export default function GarantiasPage() {
  return (
    <Suspense>
      <AuthProviderWrapper allowedRoles={['admin', 'commercial', 'plataformas']}>
        <GarantiasPageContent />
      </AuthProviderWrapper>
    </Suspense>
  );
}
