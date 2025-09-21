

"use client";

import { useState, useEffect } from 'react';
import type { DispatchOrder, Product, DispatchException, CancellationRequest, User } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
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
import { processDispatch, getCancellationRequests, cancelPendingDispatchItems } from '@/lib/api';
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
import { Checkbox } from './ui/checkbox';
import { useAuth } from '@/hooks/use-auth';

interface ProcessDispatchDialogProps {
  order: DispatchOrder;
  productsById: Record<string, Product>;
  children: React.ReactNode;
  onDispatchProcessed: () => void;
}

interface AnnulmentDialogState {
    isOpen: boolean;
    guide: string;
    request: CancellationRequest | null;
}

interface AnnulmentItem {
    selected: boolean;
    quantity: number;
    maxQuantity: number;
}

export function ProcessDispatchDialog({ order: initialOrder, productsById, children, onDispatchProcessed }: ProcessDispatchDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<DispatchOrder>(initialOrder);
  const [trackingNumbers, setTrackingNumbers] = useState('');
  const [exceptions, setExceptions] = useState<DispatchException[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const [newExceptionTracking, setNewExceptionTracking] = useState('');
  
  // State for the new inline annulment flow
  const [annulmentDialog, setAnnulmentDialog] = useState<AnnulmentDialogState>({ isOpen: false, guide: '', request: null });
  const [itemsToAnnul, setItemsToAnnul] = useState<Record<string, AnnulmentItem>>({});
  const [isAnnulling, setIsAnnulling] = useState(false);

  useEffect(() => {
    if (open) {
      setOrder(initialOrder);
      setTrackingNumbers('');
      setExceptions([]);
    }
  }, [open, initialOrder]);


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
    
    try {
        await processDispatch(order.id, trackingList, exceptions);
        toast({ title: '¡Éxito!', description: 'La orden ha sido despachada correctamente.' });
        onDispatchProcessed();
        setOpen(false);
        setTrackingNumbers('');
        setExceptions([]);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        
        // Check if it's our specific cancellation error
        const cancellationMatch = errorMessage.match(/La guía (.*) tiene una solicitud de anulación pendiente/);
        if (cancellationMatch) {
            const blockedGuide = cancellationMatch[1];
            const cancellationRequests = await getCancellationRequests();
            const relevantRequest = cancellationRequests.find(r => r.trackingNumber === blockedGuide && r.status === 'pending');
            
            if (relevantRequest) {
                // Initialize items to annul with all products in the current order
                const initialItems = order.products.reduce((acc, p) => {
                    const key = p.variantId ? `${p.productId}|${p.variantId}` : p.productId;
                    acc[key] = { selected: false, quantity: p.quantity, maxQuantity: p.quantity };
                    return acc;
                }, {} as Record<string, AnnulmentItem>);
                
                setItemsToAnnul(initialItems);
                setAnnulmentDialog({ isOpen: true, guide: blockedGuide, request: relevantRequest });
            } else {
                 toast({ variant: 'destructive', title: 'Error al procesar', description: errorMessage });
            }
        } else {
            toast({ variant: 'destructive', title: 'Error al procesar', description: errorMessage });
        }
    } finally {
        setIsProcessing(false);
    }
  };

  const handleConfirmAnnulment = async () => {
    if (!annulmentDialog.request) return;

    const itemsToCancelForApi = Object.entries(itemsToAnnul)
        .filter(([, val]) => val.selected && val.quantity > 0)
        .map(([key, val]) => {
            const ids = key.split('|');
            const productId = ids[0];
            const variantId = ids.length > 1 ? ids[1] : undefined;
            
            return {
                productId: productId,
                variantId: variantId,
                quantity: val.quantity,
            };
        });

    if (itemsToCancelForApi.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar al menos un producto e indicar una cantidad mayor a 0.' });
        return;
    }
    
    setIsAnnulling(true);
    try {
        const updatedOrderData = await cancelPendingDispatchItems(order.id, itemsToCancelForApi, user, annulmentDialog.guide);

        toast({
            title: '¡Anulación Exitosa!',
            description: `Se anularon los productos seleccionados y se restauró el stock.`
        });
        
        // Remove the blocked guide from the textarea
        setTrackingNumbers(prev => prev.split('\n').filter(tn => tn.trim() !== annulmentDialog.guide).join('\n'));

        setAnnulmentDialog({ isOpen: false, guide: '', request: null });

        if (updatedOrderData.status === 'Anulada') {
            // If the whole order was cancelled, close the dialog and refresh
            toast({ title: 'Orden Completamente Anulada', description: 'Todos los productos fueron removidos, la orden ha sido anulada.' });
            setOpen(false);
            onDispatchProcessed();
        } else {
            // Otherwise, just update the order state locally to continue processing
            setOrder(prevOrder => ({
                ...prevOrder,
                products: updatedOrderData.products,
                totalItems: updatedOrderData.totalItems,
            }));
        }


    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        toast({ variant: 'destructive', title: 'Error al Anular', description: errorMessage });
    } finally {
        setIsAnnulling(false);
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
  
  const getExceptionTrackingForProduct = (productId: string, variantId?: string): string | null => {
    if (!order.exceptions) return null;

    for (const exception of order.exceptions) {
        const found = exception.products.some(p => p.productId === productId && p.variantId === variantId);
        if (found) {
            return exception.trackingNumber;
        }
    }
    return null;
  }

  const handleAnnulmentQuantityChange = (key: string, newQuantity: number) => {
    const item = itemsToAnnul[key];
    if (item && newQuantity >= 0 && newQuantity <= item.maxQuantity) {
        setItemsToAnnul(prev => ({
            ...prev,
            [key]: { ...item, quantity: newQuantity }
        }));
    }
  }

  return (
    <>
    <Dialog open={annulmentDialog.isOpen} onOpenChange={(open) => !open && setAnnulmentDialog({isOpen: false, guide: '', request: null})}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Anulación Requerida</DialogTitle>
                <DialogDescription>
                    La guía <span className="font-mono font-semibold">{annulmentDialog.guide}</span> tiene una solicitud de anulación.
                    Selecciona los productos de esta orden de despacho que corresponden a la guía que deseas anular. El stock será restaurado.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3 max-h-60 overflow-y-auto">
                {order.products.map(p => {
                     const key = p.variantId ? `${p.productId}|${p.variantId}` : p.productId;
                     const item = itemsToAnnul[key];
                     if (!item) return null;
                     return (
                        <div key={key} className="flex items-center space-x-3 p-2 border rounded-md">
                            <Checkbox
                                id={key}
                                checked={item.selected || false}
                                onCheckedChange={(checked) => setItemsToAnnul(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key], selected: !!checked }
                                }))}
                            />
                            <Label htmlFor={key} className="text-sm font-medium flex-1">
                                {p.name} ({p.sku})
                            </Label>
                             <Input 
                                type="number"
                                className="w-24 h-8"
                                value={item.quantity}
                                onChange={(e) => handleAnnulmentQuantityChange(key, parseInt(e.target.value, 10) || 0)}
                                max={item.maxQuantity}
                                min="0"
                                disabled={!item.selected}
                            />
                            <span className="text-sm text-muted-foreground">/ {item.maxQuantity}</span>
                        </div>
                    )
                })}
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => setAnnulmentDialog({ isOpen: false, guide: '', request: null })}>Cancelar</Button>
                <Button onClick={handleConfirmAnnulment} disabled={isAnnulling}>
                    {isAnnulling ? 'Anulando...' : 'Confirmar Anulación'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
          {children}
      </DialogTrigger>
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
                                    <TableHead>Guía Excepción</TableHead>
                                    <TableHead className="text-right">Cant.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.products.map((p, index) => {
                                    const exceptionTracking = isPartial ? getExceptionTrackingForProduct(p.productId, p.variantId) : null;
                                    const uniqueKey = `${p.productId}-${p.variantId || 'simple'}-${index}`;
                                    return (
                                        <TableRow key={uniqueKey}>
                                            <TableCell>
                                                <div>{p.name}</div>
                                                <div className="text-xs text-muted-foreground">{p.sku}</div>
                                            </TableCell>
                                            <TableCell>
                                                {exceptionTracking ? (
                                                    <span className="font-mono text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded">
                                                        {exceptionTracking}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">N/A</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">{p.quantity}</TableCell>
                                        </TableRow>
                                    );
                                })}
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
                {!isPartial && (
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
                )}
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
    </>
  );
}
