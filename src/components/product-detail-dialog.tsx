

"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getProductById, getProductPerformanceData } from '@/lib/api';
import type { Product, ProductPerformanceData } from '@/lib/types';
import SalesChart from './sales-chart';
import CarrierChart from './carrier-chart';
import ReturnsChart from './returns-chart';
import { subDays, format, startOfDay } from 'date-fns';

interface ProductDetailDialogProps {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailDialog({ productId, open, onOpenChange }: ProductDetailDialogProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [performanceData, setPerformanceData] = useState<ProductPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productId && open) {
      setLoading(true);
      Promise.all([
        getProductById(productId),
        getProductPerformanceData(productId),
      ]).then(([productData, perfData]) => {
        setProduct(productData);
        setPerformanceData(perfData);
        setLoading(false);
      });
    }
  }, [productId, open]);

  const salesData = useMemo(() => {
    if (!performanceData) return [];
    const salesByDay = performanceData.salesByDay;

    const data = Array.from({ length: 30 }).map((_, i) => {
      const date = subDays(new Date(), i);
      const dayKey = format(startOfDay(date), 'yyyy-MM-dd');
      return {
        date: dayKey,
        sales: salesByDay[dayKey] || 0,
      };
    }).reverse();

    return data;
  }, [performanceData]);

  const returnsData = useMemo(() => {
    if (!performanceData) return [];
    const returnsByDay = performanceData.returnsByDay;

    const data = Array.from({ length: 30 }).map((_, i) => {
        const date = subDays(new Date(), i);
        const dayKey = format(startOfDay(date), 'yyyy-MM-dd');
        return {
            date: dayKey,
            returns: returnsByDay[dayKey] || 0,
        };
    }).reverse();
}, [performanceData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Product Details</DialogTitle>
          <DialogDescription>Detailed information and performance for the selected product.</DialogDescription>
        </DialogHeader>
        <div className="py-6 space-y-6">
          {loading || !product ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                 <Skeleton className="h-64 w-full" />
                 <Skeleton className="h-64 w-full" />
                 <Skeleton className="h-64 w-full" />
                 <Skeleton className="h-64 w-full" />
               </div>
            </div>
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-6">
                    <div className="sm:w-1/4 flex-shrink-0">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={200}
                        height={200}
                        className="rounded-lg object-cover aspect-square w-full"
                      />
                    </div>
                    <div className="sm:w-3/4 space-y-2">
                        <h2 className="text-2xl font-bold font-headline break-words">{product.name}</h2>
                        <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
                        <p className="pt-2 text-muted-foreground break-words">{product.description}</p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-center">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Price</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">${product.price.toLocaleString('en-US')}</p>
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
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Sales Performance</CardTitle>
                    <CardDescription>Sales over the last 30 days.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SalesChart data={salesData} />
                  </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Returns</CardTitle>
                        <CardDescription>Product returns over the last 30 days.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ReturnsChart data={returnsData} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sales by Carrier</CardTitle>
                        <CardDescription>Distribution of units dispatched by each carrier.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CarrierChart data={performanceData?.salesByCarrier || []} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sales by Platform</CardTitle>
                        <CardDescription>Distribution of units dispatched for each platform.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CarrierChart data={performanceData?.salesByPlatform || []} />
                    </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
