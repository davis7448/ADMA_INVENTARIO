

"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
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
import { Skeleton } from './ui/skeleton';
import { getProductById, getProductPerformanceData, getVendedores, getPlatforms } from '@/lib/api';
import type { Product, ProductPerformanceData, Vendedor, Platform, ProductVariant } from '@/lib/types';
import SalesChart from './sales-chart';
import CarrierChart from './carrier-chart';
import ReturnsChart from './returns-chart';
import { subDays, format } from 'date-fns';
import { Button } from './ui/button';
import { ProductReservationDialog } from './product-reservation-dialog';
import { LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

interface ProductDetailDialogProps {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductUpdate: () => void;
}

export function ProductDetailDialog({ productId, open, onOpenChange, onProductUpdate }: ProductDetailDialogProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [performanceData, setPerformanceData] = useState<ProductPerformanceData | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('total');

  const refreshData = async () => {
    if (productId && open) {
        setLoading(true);
        Promise.all([
            getProductById(productId),
            getProductPerformanceData(productId),
            getVendedores(),
            getPlatforms(),
        ]).then(([productData, perfData, vendedorData, platformData]) => {
            setProduct(productData);
            setPerformanceData(perfData);
            setVendedores(vendedorData);
            setPlatforms(platformData);
            setLoading(false);
        });
    }
  }

  useEffect(() => {
    refreshData();
  }, [productId, open]);
  
  useEffect(() => {
    if (!open) {
      setSelectedVariantId('total');
    }
  }, [open]);

  const totalReservedStock = useMemo(() => {
    if (!product?.reservations) return 0;
    return product.reservations.reduce((acc, res) => acc + res.quantity, 0);
  }, [product]);

  const availableStock = useMemo(() => {
    if (!product) return 0;
    return product.stock - totalReservedStock;
  }, [product, totalReservedStock]);

  const getChartDataForRange = (dataSet: Record<string, number> = {}, key: 'sales' | 'returns') => {
    const data: any[] = [];
    for (let i = 29; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dayKey = format(date, 'yyyy-MM-dd');
        data.push({
            date: dayKey,
            [key]: dataSet[dayKey] || 0
        });
    }
    return data;
  };
  
  const salesData = useMemo(() => {
    if (!performanceData) return [];
    const dataSet = selectedVariantId === 'total'
      ? performanceData.salesByDay
      : performanceData.salesByVariant?.[selectedVariantId]?.byDay;
    return getChartDataForRange(dataSet, 'sales');
  }, [performanceData, selectedVariantId]);
  
  const returnsData = useMemo(() => {
    if (!performanceData) return [];
    const dataSet = selectedVariantId === 'total'
      ? performanceData.returnsByDay
      : performanceData.returnsByVariant?.[selectedVariantId]?.byDay;
    return getChartDataForRange(dataSet, 'returns');
  }, [performanceData, selectedVariantId]);
  
  const salesByCarrierData = useMemo(() => {
    if (!performanceData) return [];
    if (selectedVariantId === 'total') {
      return performanceData.salesByCarrier;
    }
    return performanceData.salesByVariant?.[selectedVariantId]?.byCarrier || [];
  }, [performanceData, selectedVariantId]);
  
  const salesByPlatformData = useMemo(() => {
    if (!performanceData) return [];
    if (selectedVariantId === 'total') {
      return performanceData.salesByPlatform;
    }
    return performanceData.salesByVariant?.[selectedVariantId]?.byPlatform || [];
  }, [performanceData, selectedVariantId]);
  
  const returnsByCarrierData = useMemo(() => {
    if (!performanceData) return [];
    if (selectedVariantId === 'total') {
      return performanceData.returnsByCarrier;
    }
    return performanceData.returnsByVariant?.[selectedVariantId]?.byCarrier || [];
  }, [performanceData, selectedVariantId]);



  const handleReservationSuccess = () => {
    setIsReservationDialogOpen(false);
    refreshData(); // Refresh product data
    onProductUpdate(); // Refresh product list view
  }


  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl max-h-[90vh] overflow-y-auto">
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

                        {product.contentLink && (
                          <div className="pt-2">
                            <Button asChild variant="outline">
                              <Link href={product.contentLink} target="_blank" rel="noopener noreferrer">
                                <LinkIcon className="mr-2 h-4 w-4" />
                                Ver Contenido en Drive
                              </Link>
                            </Button>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 pt-4 text-center">
                             <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Stock Físico</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">{product.stock}</p>
                                </CardContent>
                            </Card>
                             <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Reservado</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-blue-500">{totalReservedStock}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Disponible</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-green-600">{availableStock}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Pendiente</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-orange-500">{product.pendingStock || 0}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Averiado</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold text-destructive">{product.damagedStock || 0}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardDescription>Price</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-2xl font-bold">${product.price.toLocaleString('en-US')}</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                  </div>
                </CardContent>
                <DialogFooter className="p-4 border-t">
                    <Button onClick={() => setIsReservationDialogOpen(true)}>Gestionar Reservas</Button>
                </DialogFooter>
              </Card>

              {product.productType === 'variable' && product.variants && product.variants.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Detalle de Variantes</CardTitle>
                        <CardDescription>Desglose de inventario para cada variante del producto.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre de Variante</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Precio</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {product.variants.map(variant => (
                                    <TableRow key={variant.id}>
                                        <TableCell className="font-medium">{variant.name}</TableCell>
                                        <TableCell>{variant.sku}</TableCell>
                                        <TableCell className="text-right">${variant.price.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-semibold">{variant.stock}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
              )}

              {product.reservations && product.reservations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Inventario Reservado</CardTitle>
                        <CardDescription>Detalle de las unidades reservadas por cada vendedor.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vendedor</TableHead>
                                    <TableHead>Plataforma</TableHead>
                                    <TableHead>Variante (SKU)</TableHead>
                                    <TableHead>ID Externo</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead className="text-right">Cantidad</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {product.reservations.map(res => (
                                    <TableRow key={res.id}>
                                        <TableCell>{vendedores.find(v => v.id === res.vendedorId)?.name || 'N/A'}</TableCell>
                                        <TableCell>{platforms.find(p => p.id === res.platformId)?.name || 'N/A'}</TableCell>
                                        <TableCell className="font-mono text-xs">{res.variantSku || 'N/A'}</TableCell>
                                        <TableCell className="font-mono text-xs">{res.externalId}</TableCell>
                                        <TableCell>{res.customerEmail}</TableCell>
                                        <TableCell className="text-right font-medium">{res.quantity}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
              )}

              {product.productType === 'variable' && (
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                    <Label htmlFor="variant-filter" className="text-sm font-medium">
                        Mostrar datos para:
                    </Label>
                    <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                        <SelectTrigger id="variant-filter" className="w-[300px]">
                            <SelectValue placeholder="Seleccionar vista" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="total">Todas las Variantes (Total)</SelectItem>
                            {product.variants?.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                    {v.name} ({v.sku})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
              )}

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
                        <CarrierChart data={salesByCarrierData} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sales by Platform</CardTitle>
                        <CardDescription>Distribution of units dispatched for each platform.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CarrierChart data={salesByPlatformData} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Returns by Carrier</CardTitle>
                        <CardDescription>Distribution of units returned by each carrier.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CarrierChart data={returnsByCarrierData} />
                    </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
     {product && (
        <ProductReservationDialog 
            open={isReservationDialogOpen}
            onOpenChange={setIsReservationDialogOpen}
            product={product}
            vendedores={vendedores}
            platforms={platforms}
            onSuccess={handleReservationSuccess}
        />
     )}
    </>
  );
}
