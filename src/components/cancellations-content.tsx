"use client";

import { useState, useEffect, useTransition } from 'react';
import type { CancellationRequest, DispatchOrder, Product } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { getCancellationRequests, createCancellationRequests, updateCancellationRequestStatus, getDispatchOrders, cancelPendingDispatchItems, getProducts } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { formatToTimeZone } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

interface AnnulmentItem {
    selected: boolean;
    quantity: number;
    maxQuantity: number;
    name: string;
    sku: string;
}

export function CancellationsContent() {
    const { user, currentWarehouse } = useAuth();
    const { toast } = useToast();
    const [requests, setRequests] = useState<CancellationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, startSubmittingTransition] = useTransition();
    const [isUpdating, startUpdatingTransition] = useTransition();
    const [guidesToCancel, setGuidesToCancel] = useState('');
    const [submissionWarnings, setSubmissionWarnings] = useState<string[]>([]);

    // State for the cancellation dialog
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState<DispatchOrder | null>(null);
    const [itemsToAnnul, setItemsToAnnul] = useState<Record<string, AnnulmentItem>>({});
    const [guideToCancelInDialog, setGuideToCancelInDialog] = useState('');
    const [requestToUpdate, setRequestToUpdate] = useState<CancellationRequest | null>(null);
    
    const canManageRequests = user?.role === 'admin' || user?.role === 'logistics';

    const fetchRequests = async () => {
        setLoading(true);
        const fetchedRequests = await getCancellationRequests(currentWarehouse?.id);
        setRequests(fetchedRequests);
        setLoading(false);
    }

    useEffect(() => {
        if(user) {
            fetchRequests();
        }
    }, [currentWarehouse, user]);

    const handleSubmit = () => {
        if (!user) return;
        
        const trackingNumbers = guidesToCancel.split('\n').map(tn => tn.trim()).filter(Boolean);
        if (trackingNumbers.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Por favor, introduce al menos un número de guía.'
            });
            return;
        }

        startSubmittingTransition(async () => {
            setSubmissionWarnings([]);
            try {
                const { alreadyDispatched } = await createCancellationRequests(trackingNumbers, user);

                toast({
                    title: 'Solicitud Enviada',
                    description: `Se han procesado ${trackingNumbers.length} guías.`
                });
                
                if (alreadyDispatched.length > 0) {
                    setSubmissionWarnings(alreadyDispatched);
                }

                setGuidesToCancel('');
                fetchRequests(); // Refresh the list

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
                toast({
                    variant: 'destructive',
                    title: 'Error al Crear Solicitud',
                    description: errorMessage
                });
            }
        });
    };

    const handleOpenCancelDialog = async (request: CancellationRequest) => {
        setRequestToUpdate(request);
        const { orders: allOrders } = await getDispatchOrders({ fetchAll: true, filters: { warehouseId: currentWarehouse?.id } });
        
        // A guide can be in `trackingNumbers` (dispatched) or `exceptions` (not dispatched)
        const targetOrder = allOrders.find(order => 
            order.trackingNumbers?.includes(request.trackingNumber) || 
            order.exceptions?.some(ex => ex.trackingNumber === request.trackingNumber)
        );

        if (!targetOrder) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se encontró una orden de despacho asociada a esta guía. La anulación no puede continuar.'
            });
            return;
        }
        
        setGuideToCancelInDialog(request.trackingNumber);
        setOrderToCancel(targetOrder);

        const isException = targetOrder.exceptions?.some(ex => ex.trackingNumber === request.trackingNumber);

        // If it's an exception, only products from that exception can be cancelled
        // If it's a regular dispatch, all products from the order can be cancelled
        const productsInScope = isException
            ? targetOrder.exceptions.find(ex => ex.trackingNumber === request.trackingNumber)?.products || []
            : targetOrder.products;

        const initialItemsToAnnul = productsInScope.reduce((acc, p) => {
            // Use a composite key for variants
            const key = p.variantId ? `${p.productId}|${p.variantId}` : p.productId;
            const fullProduct = targetOrder.products.find(op => op.productId === p.productId && (op.variantId || undefined) === (p.variantId || undefined));
            
            if (fullProduct) {
                acc[key] = {
                    selected: false,
                    quantity: fullProduct.quantity,
                    maxQuantity: fullProduct.quantity,
                    name: fullProduct.name,
                    sku: fullProduct.sku,
                };
            }
            return acc;
        }, {} as Record<string, AnnulmentItem>);
        
        setItemsToAnnul(initialItemsToAnnul);
        setIsCancelDialogOpen(true);
    };

    const handleConfirmCancellation = () => {
        if (!orderToCancel || !user || !requestToUpdate) return;
    
        const itemsToCancelForApi = Object.entries(itemsToAnnul)
            .filter(([, val]) => val.selected && val.quantity > 0)
            .map(([key, val]) => {
                const ids = key.split('|');
                return {
                    productId: ids[0],
                    variantId: ids.length > 1 ? ids[1] : undefined,
                    quantity: val.quantity,
                };
            });
        
        if (itemsToCancelForApi.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar al menos un producto e indicar una cantidad mayor a 0.' });
            return;
        }

        startUpdatingTransition(async () => {
            try {
                await cancelPendingDispatchItems(orderToCancel.id, itemsToCancelForApi, user, [guideToCancelInDialog]);
                // The status of the request is now handled inside cancelPendingDispatchItems
                // await updateCancellationRequestStatus(requestToUpdate.id, 'completed', user);

                toast({
                    title: '¡Anulación Exitosa!',
                    description: 'La guía ha sido marcada como anulada y el stock ha sido restaurado/ajustado.'
                });
                setIsCancelDialogOpen(false);
                fetchRequests();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
                toast({ variant: 'destructive', title: 'Error al Anular', description: errorMessage });
            }
        });
    };
    
    const handleRejectCancellation = async (requestId: string) => {
        startUpdatingTransition(async () => {
            try {
                await updateCancellationRequestStatus(requestId, 'rejected', user);
                toast({
                    title: 'Solicitud Rechazada',
                    description: 'La solicitud de anulación ha sido marcada como rechazada.'
                });
                fetchRequests();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
                toast({ variant: 'destructive', title: 'Error al Rechazar', description: errorMessage });
            }
        });
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

    const getStatusBadge = (status: 'pending' | 'completed' | 'rejected', isDispatched?: boolean) => {
        const badges = [];
        
        switch (status) {
            case 'pending':
                badges.push(<Badge key="status" variant="secondary">Pendiente</Badge>);
                if (isDispatched) {
                    badges.push(<Badge key="dispatch" variant="outline" className="ml-2 border-orange-500 text-orange-500">Revisión Física</Badge>);
                }
                break;
            case 'completed':
                badges.push(<Badge key="status" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Anulada</Badge>);
                break;
            case 'rejected':
                badges.push(<Badge key="status" variant="destructive">Rechazada</Badge>);
                break;
            default:
                badges.push(<Badge key="status" variant="outline">Desconocido</Badge>);
                break;
        }

        return <div className="flex items-center gap-2">{badges}</div>;
    };

    return (
        <>
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Confirmar Anulación de Guía</DialogTitle>
                    <DialogDescription>
                        La guía <span className="font-mono font-semibold">{guideToCancelInDialog}</span> está en la orden de despacho <span className="font-semibold">{orderToCancel?.dispatchId}</span>. 
                        Selecciona los productos y cantidades a anular. El stock será ajustado.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-3 max-h-60 overflow-y-auto">
                    {Object.keys(itemsToAnnul).length > 0 ? Object.entries(itemsToAnnul).map(([key, item]) => (
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
                                {item.name} ({item.sku})
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
                    )) : (
                        <p className="text-sm text-muted-foreground text-center">No hay productos elegibles para anular en esta guía.</p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setIsCancelDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleConfirmCancellation} disabled={isUpdating}>
                        {isUpdating ? 'Anulando...' : 'Confirmar Anulación'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Solicitud de Anulación de Guías</h1>
                <p className="text-muted-foreground">Envía un listado de guías para solicitar su anulación en el sistema.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Nueva Solicitud de Anulación</CardTitle>
                    <CardDescription>Pega aquí la lista de números de guía que deseas anular, una por línea.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="guides-textarea">Números de Guía</Label>
                        <Textarea
                            id="guides-textarea"
                            placeholder="GUIA001\nGUIA002\nGUIA003..."
                            rows={8}
                            value={guidesToCancel}
                            onChange={(e) => setGuidesToCancel(e.target.value)}
                        />
                    </div>
                     {submissionWarnings.length > 0 && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Advertencia: Guías Ya Despachadas</AlertTitle>
                            <AlertDescription>
                                Las siguientes guías ya han sido despachadas. Su anulación no es segura y debe ser verificada manualmente:
                                <ul className="list-disc pl-5 mt-2">
                                    {submissionWarnings.map(tn => <li key={tn} className="font-mono">{tn}</li>)}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Enviando Solicitud...' : 'Enviar Solicitud de Anulación'}
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Solicitudes</CardTitle>
                    <CardDescription>Un registro de todas las solicitudes de anulación.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha de Solicitud</TableHead>
                                <TableHead>Número de Guía</TableHead>
                                <TableHead>Solicitado por</TableHead>
                                <TableHead>Estado</TableHead>
                                {canManageRequests && <TableHead className="text-right">Acciones</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={canManageRequests ? 5 : 4}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : requests.length > 0 ? (
                                requests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{formatToTimeZone(new Date(req.requestDate), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell className="font-mono">{req.trackingNumber}</TableCell>
                                        <TableCell>{req.requestedBy.name}</TableCell>
                                        <TableCell>{getStatusBadge(req.status, req.isDispatched)}</TableCell>
                                        {canManageRequests && (
                                            <TableCell className="text-right">
                                                {req.status === 'pending' && (
                                                    <div className="flex gap-2 justify-end">
                                                        <Button size="sm" variant="outline" onClick={() => handleOpenCancelDialog(req)} disabled={isUpdating}>Anular</Button>
                                                        <Button size="sm" variant="destructive" onClick={() => handleRejectCancellation(req.id)} disabled={isUpdating}>Rechazar</Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={canManageRequests ? 5 : 4} className="h-24 text-center">No hay solicitudes de anulación.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
        </>
    );
}