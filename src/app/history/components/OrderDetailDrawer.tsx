'use client';

import { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Package, Truck, AlertTriangle, XCircle, Calendar, User, Building2 } from 'lucide-react';

interface DispatchOrderProduct {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  quantity: number;
}

interface DispatchExceptionProduct {
  productId: string;
  quantity: number;
  variantId?: string;
  variantSku?: string;
}

interface DispatchException {
  trackingNumber: string;
  products: DispatchExceptionProduct[];
}

interface DispatchOrder {
  id: string;
  dispatchId: string;
  date: string;
  totalItems: number;
  platformId: string;
  carrierId: string;
  products: DispatchOrderProduct[];
  status: 'Pendiente' | 'Despachada' | 'Parcial' | 'Anulada';
  trackingNumbers: string[];
  exceptions: DispatchException[];
  cancelledExceptions?: DispatchException[];
  createdBy?: {
    id: string;
    name: string;
  };
  warehouseId?: string;
}

interface OrderDetailDrawerProps {
  order: DispatchOrder | null;
  isOpen: boolean;
  onClose: () => void;
  platformMap: { [key: string]: string };
  carrierMap: { [key: string]: string };
}

export function OrderDetailDrawer({
  order,
  isOpen,
  onClose,
  platformMap,
  carrierMap,
}: OrderDetailDrawerProps) {
  if (!order) return null;

  // Create product lookup map from order products
  const productMap = useMemo(() => {
    const map: {[key: string]: string} = {};
    order.products.forEach((p: any) => {
      map[p.productId] = p.name;
      if (p.variantId) {
        map[p.variantId] = p.name;
      }
    });
    return map;
  }, [order.products]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pendiente':
        return <Badge variant="default">Pendiente</Badge>;
      case 'Despachada':
        return <Badge variant="default" className="bg-green-500">Despachada</Badge>;
      case 'Parcial':
        return <Badge variant="secondary">Parcial</Badge>;
      case 'Anulada':
        return <Badge variant="destructive">Anulada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalProducts = order.products.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Orden #{order.dispatchId}
          </SheetTitle>
          <SheetDescription>
            Detalle completo de la orden de despacho
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Información General */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Información General
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Fecha</p>
                  <p className="font-medium">
                    {order.date && format(new Date(order.date), "dd/MM/yyyy HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Creado por</p>
                  <p className="font-medium">{order.createdBy?.name || 'Sistema'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Plataforma</p>
                  <p className="font-medium">{platformMap[order.platformId] || order.platformId}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Transportadora</p>
                  <p className="font-medium">{carrierMap[order.carrierId] || order.carrierId}</p>
                </div>
              </div>
              
              <div className="col-span-2 flex items-center justify-between pt-2">
                <div>
                  <p className="text-muted-foreground text-xs">Estado</p>
                  <div className="mt-1">{getStatusBadge(order.status)}</div>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Total Items</p>
                  <p className="text-2xl font-bold">{order.totalItems}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Productos */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Package className="h-4 w-4" />
              Productos ({totalProducts} unidades)
            </h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Producto</TableHead>
                    <TableHead className="text-xs w-24">SKU</TableHead>
                    <TableHead className="text-xs w-16 text-right">Cant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.products.map((product, idx) => (
                    <TableRow key={`${product.productId}-${idx}`}>
                      <TableCell className="text-sm py-2">
                        <div className="font-medium truncate max-w-[200px]">{product.name}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2">
                        {product.sku}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-right py-2">
                        {product.quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Guías Despachadas */}
          <Accordion type="multiple" defaultValue={["dispatched"]} className="w-full">
            <AccordionItem value="dispatched">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-green-500" />
                  <span>Guías Despachadas ({order.trackingNumbers.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {order.trackingNumbers.length > 0 ? (
                    order.trackingNumbers.map((trackingNumber, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded-md"
                      >
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-sm font-mono">{trackingNumber}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay guías despachadas</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Guías con Excepción */}
            <AccordionItem value="exceptions">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>Guías con Excepción ({order.exceptions.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {order.exceptions.length > 0 ? (
                    order.exceptions.map((exception, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-mono font-medium">
                            {exception.trackingNumber}
                          </span>
                        </div>
                        <div className="pl-6 space-y-1">
                          <p className="text-xs text-muted-foreground">Productos afectados:</p>
                          {exception.products.map((prod, pIdx) => (
                            <p key={pIdx} className="text-sm">
                              • {productMap[prod.productId] || productMap[prod.variantId || ''] || prod.variantSku || prod.productId}: {prod.quantity} unidad
                              {prod.quantity > 1 ? 'es' : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay guías con excepción</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Guías Canceladas */}
            <AccordionItem value="cancelled">
              <AccordionTrigger className="text-sm font-medium hover:no-underline">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>Guías Canceladas ({order.cancelledExceptions?.length || 0})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {order.cancelledExceptions && order.cancelledExceptions.length > 0 ? (
                    order.cancelledExceptions.map((exception, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-red-50 dark:bg-red-950/20 rounded-md space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-mono font-medium line-through">
                            {exception.trackingNumber}
                          </span>
                        </div>
                        <div className="pl-6 space-y-1">
                          <p className="text-xs text-muted-foreground">Productos:</p>
                          {exception.products.map((prod, pIdx) => (
                            <p key={pIdx} className="text-sm">
                              • {productMap[prod.productId] || productMap[prod.variantId || ''] || prod.variantSku || prod.productId}: {prod.quantity} unidad
                              {prod.quantity > 1 ? 'es' : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No hay guías canceladas</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
}
