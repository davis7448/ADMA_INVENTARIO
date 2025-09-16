
"use client";

import { useMemo } from 'react';
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
import type { InventoryMovement, Product, DispatchOrder } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { generatePickingListPDF } from '@/lib/pdf';
import { formatToTimeZone } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface HistoryContentProps {
    initialMovements: InventoryMovement[];
    initialDispatchOrders: DispatchOrder[];
    productsById: Record<string, Product>;
    platformNames: Record<string, string>;
    carrierNames: Record<string, string>;
}

export function HistoryContent({
    initialMovements,
    initialDispatchOrders,
    productsById,
    platformNames,
    carrierNames,
}: HistoryContentProps) {

  const handleDownloadPdf = (order: DispatchOrder) => {
    const productsForPdf = order.products.map(p => ({ ...p, dispatchQuantity: p.quantity }));
    generatePickingListPDF(order.dispatchId, productsForPdf, platformNames[order.platformId], carrierNames[order.carrierId], new Date(order.date));
  };
  
  const handleExportMovementsExcel = () => {
    const flattenedData = initialMovements.map(movement => ({
        'ID Movimiento': movement.movementId,
        'Fecha': formatToTimeZone(new Date(movement.date), "dd/MM/yyyy HH:mm"),
        'Tipo': movement.type,
        'SKU Producto': productsById[movement.productId]?.sku || 'N/A',
        'Nombre Producto': movement.productName,
        'Cantidad': movement.quantity,
        'Notas': movement.notes,
    }));

    const worksheet = XLSX.utils.json_to_sheet(flattenedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");
    XLSX.writeFile(workbook, `Historial-Movimientos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportExcel = () => {
    const flattenedData = initialDispatchOrders.flatMap(order => 
        order.products.map(product => ({
            'ID Despacho': order.dispatchId,
            'Fecha': formatToTimeZone(new Date(order.date), "dd/MM/yyyy HH:mm"),
            'Plataforma': platformNames[order.platformId] || 'N/A',
            'Transportadora': carrierNames[order.carrierId] || 'N/A',
            'SKU Producto': product.sku,
            'Nombre Producto': product.name,
            'Cantidad': product.quantity,
        }))
    );

    const worksheet = XLSX.utils.json_to_sheet(flattenedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Despachos");
    XLSX.writeFile(workbook, `Historial-Despachos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const getMovementBadgeClass = (type: 'Entrada' | 'Salida' | 'Averia') => {
    switch (type) {
      case 'Entrada':
        return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'Salida':
        return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
      case 'Averia':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
      default:
        return '';
    }
  };

  const getDispatchStatusBadge = (status: 'Pendiente' | 'Despachada' | 'Parcial') => {
    switch (status) {
      case 'Pendiente':
        return <Badge variant="destructive">Pendiente</Badge>;
      case 'Despachada':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Despachada</Badge>;
      case 'Parcial':
        return <Badge variant="secondary">Parcial</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Historial de Inventario</h1>
        <p className="text-muted-foreground">Un registro de todas las transacciones de stock.</p>
      </div>

       <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                <CardTitle>Movimientos Recientes</CardTitle>
                <CardDescription>
                    Mostrando las últimas entradas y salidas de inventario.
                </CardDescription>
                </div>
                <Button variant="outline" onClick={handleExportMovementsExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar a Excel
                </Button>
            </div>
        </CardHeader>
        <CardContent>
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>ID Mov.</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Cantidad</TableHead>
                <TableHead>Notas</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {initialMovements.length > 0 ? (
                initialMovements.map((movement) => (
                <TableRow key={movement.id}>
                    <TableCell className="font-mono text-xs">{movement.movementId || 'N/A'}</TableCell>
                    <TableCell className="font-medium">
                    {formatToTimeZone(new Date(movement.date), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>{movement.productName}</TableCell>
                    <TableCell>
                    <Badge variant="outline" className={getMovementBadgeClass(movement.type)}>
                        {movement.type}
                    </Badge>
                    </TableCell>
                    <TableCell className="text-center">{movement.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{movement.notes}</TableCell>
                </TableRow>
                ))
            ) : (
                <TableRow>
                <TableCell colSpan={6} className="text-center">
                    No hay movimientos de inventario registrados.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
        </CardContent>
    </Card>

    <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                <CardTitle>Órdenes de Despacho Generadas</CardTitle>
                <CardDescription>
                    Un historial de todos los picking lists generados.
                </CardDescription>
                </div>
                <Button variant="outline" onClick={handleExportExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Exportar a Excel
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            {initialDispatchOrders.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                    {initialDispatchOrders.map((order) => (
                        <AccordionItem value={order.id} key={order.id}>
                            <AccordionTrigger>
                                <div className="flex justify-between items-center w-full pr-4">
                                    <div className="text-left">
                                        <p className="font-semibold">{order.dispatchId}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatToTimeZone(new Date(order.date), "dd/MM/yyyy HH:mm")} - {order.totalItems} items
                                        </p>
                                    </div>
                                    <div className="text-center px-4">
                                        {getDispatchStatusBadge(order.status)}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium">{platformNames[order.platformId]}</p>
                                        <p className="text-sm text-muted-foreground">{carrierNames[order.carrierId]}</p>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="p-4 bg-muted/50 rounded-md">
                                    <h4 className="font-semibold mb-2">Productos de la Orden</h4>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Producto</TableHead>
                                                <TableHead>SKU</TableHead>
                                                <TableHead className="text-right">Cant. Pedida</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {order.products.map((p) => (
                                                <TableRow key={p.productId}>
                                                    <TableCell>{p.name}</TableCell>
                                                    <TableCell>{p.sku}</TableCell>
                                                    <TableCell className="text-right">{p.quantity}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {order.exceptions && order.exceptions.length > 0 && (
                                        <div className="mt-4">
                                            <h4 className="font-semibold mb-2 text-destructive">Excepciones (No Enviados)</h4>
                                            {order.exceptions.map((ex, index) => (
                                                <div key={index} className="mb-3">
                                                    <p className="text-sm font-semibold">Guía de Excepción: <span className="font-mono bg-destructive/10 px-2 py-1 rounded">{ex.trackingNumber}</span></p>
                                                    {ex.products && ex.products.length > 0 && (
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Producto</TableHead>
                                                                    <TableHead className="text-right">Cant. no enviada</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {ex.products.map(p => (
                                                                    <TableRow key={p.productId}>
                                                                        <TableCell>{productsById[p.productId]?.name || 'Producto desconocido'}</TableCell>
                                                                        <TableCell className="text-right">{p.quantity}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex justify-end mt-4">
                                        <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(order)}>
                                            <Download className="mr-2 h-4 w-4" />
                                            Descargar PDF
                                        </Button>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            ) : (
                <div className="text-center text-muted-foreground py-8">
                    No se han generado órdenes de despacho.
                </div>
            )}
        </CardContent>
    </Card>
    </div>
  );
}
