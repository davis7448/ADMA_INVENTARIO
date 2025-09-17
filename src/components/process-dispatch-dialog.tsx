

"use client";

import { useState } from 'react';
import type { DispatchOrder, Product, DispatchException, DispatchExceptionProduct } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { processDispatch } from '@/lib/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Input } from './ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
  } from "@/components/ui/accordion";
import { CancelDispatchDialog } from './cancel-dispatch-dialog';

interface ProcessDispatchDialogProps {
  order: DispatchOrder;
  productsById: Record<string, Product>;
  children: React.ReactNode;
  onDispatchProcessed: () => void;
}

export function ProcessDispatchDialog({ order, productsById, children, onDispatchProcessed }: ProcessDispatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [trackingNumbers, setTrackingNumbers] = useState('');
  const [exceptions, setExceptions] = useState<DispatchException[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const [newExceptionTracking, setNewExceptionTracking] = useState('');

  const handleAddExceptionGroup = () => {
    if (!newExceptionTracking.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'El número de guía de la excepción no puede estar vacío.' });
        return;
    }
    setExceptions([...exceptions, { trackingNumber: newExceptionTracking.trim(), products: [{ productId: '', quantity: 1 }] }]);
    setNewExceptionTracking('');
  };

  const handleRemoveExceptionGroup = (index: number) => {
    setExceptions(exceptions.filter((_, i) => i !== index));
  }

  const handleAddProductToException = (groupIndex: number) => {
    const newExceptions = [...exceptions];
    newExceptions[groupIndex].products.push({ productId: '', quantity: 1 });
    setExceptions(newExceptions);
  }

  const handleRemoveProductFromException = (groupIndex: number, productIndex: number) => {
    const newExceptions = [...exceptions];
    newExceptions[groupIndex].products = newExceptions[groupIndex].products.filter((_, i) => i !== productIndex);
    // If no products left, remove the group
    if (newExceptions[groupIndex].products.length === 0) {
        handleRemoveExceptionGroup(groupIndex);
    }
    setExceptions(newExceptions);
  }
  
  const handleExceptionProductChange = (groupIndex: number, productIndex: number, field: 'productId' | 'quantity', value: string | number) => {
    const newExceptions = [...exceptions];
    const exceptionProduct = newExceptions[groupIndex].products[productIndex];
    
    if (field === 'productId') {
        const [productId, variantId] = (value as string).split('|');
        const product = productsById[productId];
        
        exceptionProduct.productId = productId;
        if (variantId && product?.variants) {
            const variant = product.variants.find(v => v.id === variantId);
            exceptionProduct.variantId = variant?.id;
            exceptionProduct.variantSku = variant?.sku;
        } else {
            delete exceptionProduct.variantId;
            delete exceptionProduct.variantSku;
        }
    } else {
        exceptionProduct.quantity = Number(value);
    }
    setExceptions(newExceptions);
  }


  const handleSubmit = async () => {
    setIsProcessing(true);
    
    const trackingList = trackingNumbers.split('\n').map(t => t.trim()).filter(t => t);
    if (trackingList.length === 0 && exceptions.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Debe ingresar al menos un número de guía o registrar una excepción.' });
        setIsProcessing(false);
        return;
    }
    
    try {
        await processDispatch(order.id, trackingList, exceptions);
        toast({ title: 'Éxito', description: 'La orden ha sido despachada correctamente.' });
        onDispatchProcessed();
        setOpen(false);
        setTrackingNumbers('');
        setExceptions([]);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        toast({ variant: 'destructive', title: 'Error al procesar', description: errorMessage });
    } finally {
        setIsProcessing(false);
    }
  };

  const isPartial = order.status === 'Parcial';

  const selectableProducts = order.products.flatMap(p => {
    const parentProduct = productsById[p.productId];
    if (parentProduct?.productType === 'variable' && parentProduct.variants) {
      return parentProduct.variants.map(v => ({
        id: `${parentProduct.id}|${v.id}`,
        name: `${parentProduct.name} - ${v.name}`,
      }));
    }
    return [{ id: p.productId, name: p.name }];
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Procesar Despacho: {order.dispatchId}</DialogTitle>
          <DialogDescription>
            Ingresa los números de guía y registra cualquier excepción de productos que no se pudieron enviar.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 max-h-[60vh] overflow-y-auto">
            <div>
                <Card>
                    <CardHeader>
                        <CardTitle>Productos en la Orden</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Cant.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.products.map(p => (
                                    <TableRow key={p.productId + (p.variantId || '')}>
                                        <TableCell>{p.name}</TableCell>
                                        <TableCell>{p.sku}</TableCell>
                                        <TableCell className="text-right">{p.quantity}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-6">
                <div>
                    <Label htmlFor="tracking-numbers">Números de Guía Enviados (uno por línea)</Label>
                    <Textarea
                        id="tracking-numbers"
                        placeholder="Pistolea o pega aquí los números de guía que SÍ salieron."
                        value={trackingNumbers}
                        onChange={(e) => setTrackingNumbers(e.target.value)}
                        rows={5}
                    />
                </div>
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Excepciones (No Enviados)</CardTitle>
                            <CardDescription>Agrupa por guía los productos que no salieron. Se moverán a stock pendiente.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Guía de la excepción..."
                                    value={newExceptionTracking}
                                    onChange={(e) => setNewExceptionTracking(e.target.value)}
                                />
                                <Button onClick={handleAddExceptionGroup}>Añadir Grupo</Button>
                            </div>

                            <Accordion type="multiple" className="w-full">
                                {exceptions.map((ex, groupIndex) => (
                                <AccordionItem value={`item-${groupIndex}`} key={groupIndex}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <span>Guía: {ex.trackingNumber}</span>
                                            <div
                                                role="button"
                                                className="p-1 rounded-md hover:bg-muted"
                                                onClick={(e) => { e.stopPropagation(); handleRemoveExceptionGroup(groupIndex)}}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-2 pt-2">
                                        {ex.products.map((prod, prodIndex) => (
                                            <div key={prodIndex} className="flex items-center gap-2 pl-2">
                                                <Select 
                                                    value={prod.variantId ? `${prod.productId}|${prod.variantId}` : prod.productId} 
                                                    onValueChange={(val) => handleExceptionProductChange(groupIndex, prodIndex, 'productId', val)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Producto" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {selectableProducts.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Input 
                                                    type="number" 
                                                    className="w-24"
                                                    placeholder="Cant."
                                                    value={prod.quantity}
                                                    onChange={(e) => handleExceptionProductChange(groupIndex, prodIndex, 'quantity', e.target.value)}
                                                    min="1"
                                                />
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveProductFromException(groupIndex, prodIndex)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button variant="outline" size="sm" className="ml-2 mt-2" onClick={() => handleAddProductToException(groupIndex)}>
                                            <Plus className="mr-2 h-4 w-4" /> Añadir Producto
                                        </Button>
                                    </AccordionContent>
                                </AccordionItem>
                                ))}
                            </Accordion>
                            
                            {exceptions.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">No hay excepciones registradas.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>

        <DialogFooter>
          <div className="flex w-full justify-between">
            <div>
              {isPartial && (
                <CancelDispatchDialog 
                  order={order} 
                  onCancelled={() => {
                    setOpen(false);
                    onDispatchProcessed();
                  }}
                >
                    <Button variant="destructive">Anular Pendientes</Button>
                </CancelDispatchDialog>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={isProcessing}>
                {isProcessing ? 'Procesando...' : 'Confirmar Despacho'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    