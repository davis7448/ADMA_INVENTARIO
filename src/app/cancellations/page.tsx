
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

function CancellationsContent() {
    const { user } = useAuth();
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
    const [productsToCancel, setProductsToCancel] = useState<Record<string, { selected: boolean, quantity: number }>>({});
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [guideToCancelInDialog, setGuideToCancelInDialog] = useState<string>('');
    const [requestToUpdate, setRequestToUpdate] = useState<CancellationRequest | null>(null);
    
    const canManageRequests = user?.role === 'admin' || user?.role === 'logistics';

    const fetchRequests = async () => {
        setLoading(true);
        const [fetchedRequests, fetchedProducts] = await Promise.all([
            getCancellationRequests(),
            getProducts()
        ]);
        setRequests(fetchedRequests);
        setAllProducts(fetchedProducts);
        setLoading(false);
    }

    useEffect(() => {
        fetchRequests();
    }, []);

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
        const allOrders = await getDispatchOrders();
        
        // Find the dispatch order that contains this tracking number (either as dispatched or exception)
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

        const initialProductSelection = targetOrder.products.reduce((acc, p) => {
            const productInfo = allProducts.find(ap => ap.id === p.productId);
            const variantInfo = productInfo?.variants?.find(v => v.id === p.variantId);
            acc[p.sku] = { selected: false, quantity: p.quantity, name: variantInfo ? `${p.name} - ${variantInfo.name}` : p.name };
            return acc;
        }, {} as any);

        setProductsToCancel(initialProductSelection);
        setIsCancelDialogOpen(true);
    };

    const handleConfirmCancellation = () => {
        if (!orderToCancel || !user || !requestToUpdate) return;

        const itemsToCancel = Object.entries(productsToCancel)
            .filter(([, val]) => val.selected)
            .map(([sku]) => {
                const productInOrder = orderToCancel.products.find(p => p.sku === sku);
                if (!productInOrder) return null;
                return {
                    productId: productInOrder.productId,
                    variantId: productInOrder.variantId,
                    quantity: productInOrder.quantity, // For now, cancel all quantity of the item
                }
            })
            .filter(Boolean) as { productId: string; variantId?: string; quantity: number }[];
        
        if (itemsToCancel.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar al menos un producto para anular.' });
            return;
        }

        startUpdatingTransition(async () => {
            try {
                await cancelPendingDispatchItems(orderToCancel.id, itemsToCancel, user, guideToCancelInDialog);
                await updateCancellationRequestStatus(requestToUpdate.id, 'completed', user);

                toast({
                    title: '¡Anulación Exitosa!',
                    description: 'La guía ha sido marcada como anulada y el stock ha sido restaurado.'
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


    const getStatusBadge = (status: 'pending' | 'completed' | 'rejected') => {
        switch (status) {
            case 'pending':
                return <Badge variant="secondary">Pendiente</Badge>;
            case 'completed':
                return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Anulada</Badge>;
            case 'rejected':
                return <Badge variant="destructive">Rechazada</Badge>;
            default:
                return <Badge variant="outline">Desconocido</Badge>;
        }
    };

    return (
        <>
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Confirmar Anulación de Guía</DialogTitle>
                    <DialogDescription>
                        La guía <span className="font-mono font-semibold">{guideToCancelInDialog}</span> está en la orden de despacho <span className="font-semibold">{orderToCancel?.dispatchId}</span>. 
                        Selecciona los productos de esta orden que corresponden a la guía que deseas anular. El stock será restaurado.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2 max-h-60 overflow-y-auto">
                    {Object.entries(productsToCancel).map(([sku, { selected, name }]) => (
                         <div key={sku} className="flex items-center space-x-2">
                            <Checkbox
                                id={sku}
                                checked={selected}
                                onCheckedChange={(checked) => setProductsToCancel(prev => ({
                                    ...prev,
                                    [sku]: { ...prev[sku], selected: !!checked }
                                }))}
                            />
                            <Label htmlFor={sku} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {name} ({sku})
                            </Label>
                        </div>
                    ))}
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
                                        <TableCell>{getStatusBadge(req.status)}</TableCell>
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

export default function CancellationsPage() {
    return (
        <AuthProviderWrapper allowedRoles={['admin', 'commercial', 'logistics']}>
            <CancellationsContent />
        </AuthProviderWrapper>
    )
}

    
