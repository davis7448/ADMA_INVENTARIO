
"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getProductById, getInventoryMovementsByProductId } from '@/lib/api';
import type { Product, InventoryMovement } from '@/lib/types';
import SalesChart from './sales-chart';
import { subDays, format, startOfDay } from 'date-fns';

interface ProductDetailSheetProps {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailSheet({ productId, open, onOpenChange }: ProductDetailSheetProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId) {
      setLoading(true);
      Promise.all([
        getProductById(productId),
        getInventoryMovementsByProductId(productId),
      ]).then(([productData, movementData]) => {
        setProduct(productData);
        setMovements(movementData);
        setLoading(false);
      });
    }
  }, [productId]);

  const salesData = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const salesMovements = movements.filter(m => m.type === 'Salida' && new Date(m.date) >= thirtyDaysAgo);

    const salesByDay = salesMovements.reduce((acc, m) => {
      const day = format(startOfDay(new Date(m.date)), 'yyyy-MM-dd');
      acc[day] = (acc[day] || 0) + m.quantity;
      return acc;
    }, {} as Record<string, number>);

    const data = Array.from({ length: 30 }).map((_, i) => {
      const date = subDays(new Date(), i);
      const dayKey = format(startOfDay(date), 'yyyy-MM-dd');
      return {
        date: dayKey,
        sales: salesByDay[dayKey] || 0,
      };
    }).reverse();

    return data;
  }, [movements]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Product Details</SheetTitle>
          <SheetDescription>Detailed information and performance for the selected product.</SheetDescription>
        </SheetHeader>
        <div className="py-6 space-y-6">
          {loading || !product ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <div className="grid grid-cols-3 gap-4 pt-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
               <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="sm:w-1/3">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={200}
                        height={200}
                        className="rounded-lg object-cover aspect-square"
                      />
                    </div>
                    <div className="sm:w-2/3 space-y-2">
                      <h2 className="text-2xl font-bold font-headline">{product.name}</h2>
                      <p className="text-sm text-muted-foreground">{product.sku}</p>
                      <p className="pt-2">{product.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Price</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">${product.price.toFixed(2)}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>In Stock</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{product.stock}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Pending</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-orange-500">{product.pendingStock || 0}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Damaged</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-destructive">{product.damagedStock || 0}</p>
                    </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Sales Performance</CardTitle>
                  <CardDescription>Sales over the last 30 days.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SalesChart data={salesData} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
