
"use client";

import { useState, useEffect } from 'react';
import type { Product, ProductVariant } from '@/lib/types';
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
import { checkStockAvailability, StockAvailabilityOutput } from '@/ai/flows/stock-monitoring';
import { Skeleton } from './ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { Badge } from './ui/badge';
import Image from 'next/image';

interface StockAlertsContentProps {
    initialProducts: Product[];
    salesBySku: Record<string, number>;
}

interface AlertableItem {
    id: string;
    name: string;
    sku: string;
    imageUrl: string;
    physicalStock: number;
    reservedStock: number;
    salesLast7Days: number;
}

export function StockAlertsContent({ initialProducts, salesBySku }: StockAlertsContentProps) {
  const [alerts, setAlerts] = useState<(AlertableItem & { analysis: StockAvailabilityOutput })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateAlerts = async () => {
        setLoading(true);

        const itemsToCheck: AlertableItem[] = [];

        for (const product of initialProducts) {
            const totalReserved = product.reservations?.reduce((sum, res) => sum + res.quantity, 0) || 0;
            
            if (product.productType === 'simple' && product.sku) {
                itemsToCheck.push({
                    id: product.id,
                    name: product.name,
                    sku: product.sku,
                    imageUrl: product.imageUrl,
                    physicalStock: product.stock,
                    reservedStock: totalReserved,
                    salesLast7Days: salesBySku[product.sku] || 0,
                });
            } else if (product.productType === 'variable' && product.variants) {
                for (const variant of product.variants) {
                    const variantReserved = product.reservations?.filter(r => r.variantId === variant.id).reduce((sum, res) => sum + res.quantity, 0) || 0;
                    itemsToCheck.push({
                        id: `${product.id}-${variant.id}`,
                        name: `${product.name} - ${variant.name}`,
                        sku: variant.sku,
                        imageUrl: product.imageUrl,
                        physicalStock: variant.stock,
                        reservedStock: variantReserved,
                        salesLast7Days: salesBySku[variant.sku] || 0,
                    });
                }
            }
        }
        
        const analysisPromises = itemsToCheck.map(item => 
            checkStockAvailability({
                productName: item.name,
                physicalStock: item.physicalStock,
                reservedStock: item.reservedStock,
                salesLast7Days: item.salesLast7Days
            }).then(analysis => ({...item, analysis}))
        );

        const allAnalyses = await Promise.all(analysisPromises);
        const triggeredAlerts = allAnalyses.filter(item => item.analysis.alertTriggered);
        
        setAlerts(triggeredAlerts);
        setLoading(false);
    };

    generateAlerts();
  }, [initialProducts, salesBySku]);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Alertas de Disponibilidad de Stock</h1>
        <p className="text-muted-foreground">
            Productos cuyo stock disponible para reservar es peligrosamente bajo en comparación con su demanda.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Productos en Riesgo</CardTitle>
          <CardDescription>
            Estos productos podrían quedarse sin stock para nuevas reservas si no se toman acciones. 
            La alerta se activa si el stock disponible es menor a 3 días de ventas promedio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Mensaje de la IA</TableHead>
                <TableHead className="text-center">Stock Físico</TableHead>
                <TableHead className="text-center">Reservado</TableHead>
                <TableHead className="text-center">Disponible</TableHead>
                <TableHead className="text-center">Venta Diaria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                ))
              ) : alerts.length > 0 ? (
                alerts.map((item) => (
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
                            <p className="text-sm">{item.analysis.alertMessage}</p>
                        </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">{item.physicalStock}</TableCell>
                    <TableCell className="text-center font-medium text-blue-600">{item.reservedStock}</TableCell>
                    <TableCell className="text-center font-bold text-destructive">{item.analysis.availableForSale}</TableCell>
                     <TableCell className="text-center font-medium text-amber-600">{item.analysis.dailyAverageSales.toFixed(1)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    ¡No hay alertas de stock! El inventario disponible parece saludable.
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
