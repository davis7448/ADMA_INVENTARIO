"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getReceptionsAction, getReceivablePurchaseOrdersAction, startReceptionAction } from '@/app/actions/receptions';
import type { PurchaseOrder, Reception, ReceptionStatus } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PackageOpen } from 'lucide-react';

export const RECEPTION_STATUS_LABELS: Record<ReceptionStatus, string> = {
    en_conteo: 'En Conteo',
    con_discrepancia: 'Con Discrepancia',
    verificada: 'Verificada',
    cargada: 'Cargada',
};

export const RECEPTION_STATUS_VARIANT: Record<ReceptionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    en_conteo: 'secondary',
    con_discrepancia: 'destructive',
    verificada: 'default',
    cargada: 'outline',
};

export function ReceptionsContent() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [receptions, setReceptions] = useState<Reception[]>([]);
    const [receivableOrders, setReceivableOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [startingId, setStartingId] = useState<string | null>(null);

    const canReceive = !!user && ['admin', 'logistics'].includes(user.role);

    const load = async () => {
        setIsLoading(true);
        try {
            const [recs, orders] = await Promise.all([
                getReceptionsAction(),
                getReceivablePurchaseOrdersAction(),
            ]);
            setReceptions(recs);
            setReceivableOrders(orders);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudieron cargar las recepciones.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleStart = async (order: PurchaseOrder) => {
        if (!user) return;
        setStartingId(order.id);
        try {
            const result = await startReceptionAction(order.id, { id: user.id, name: user.name }, user.warehouseId);
            if (result.success && result.id) {
                toast({ title: '¡Recepción iniciada!', description: `Orden ${order.orderNumber}: cuenta cajas y unidades por línea.` });
                router.push(`/logistics/recepciones/${result.id}`);
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        } finally {
            setStartingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Recepción de Mercancía</h1>
                <p className="text-muted-foreground">Conteo, verificación y cargue a inventario de las órdenes de compra.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><PackageOpen className="h-5 w-5" />Órdenes por Recibir</CardTitle>
                    <CardDescription>Órdenes en tránsito o con líneas pendientes.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-24 w-full" /> : receivableOrders.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Orden</TableHead>
                                    <TableHead>Ref. Groupack</TableHead>
                                    <TableHead>Llegada Est.</TableHead>
                                    <TableHead>Estado</TableHead>
                                    {canReceive && <TableHead className="text-right">Acción</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {receivableOrders.map(order => (
                                    <TableRow key={order.id}>
                                        <TableCell className="font-medium">
                                            <button className="underline-offset-2 hover:underline" onClick={() => router.push(`/compras/${order.id}`)}>
                                                {order.orderNumber}
                                            </button>
                                        </TableCell>
                                        <TableCell>{order.groupackRef || '—'}</TableCell>
                                        <TableCell>{order.estimatedArrivalDate || '—'}</TableCell>
                                        <TableCell><Badge variant={order.status === 'en_transito' ? 'default' : 'outline'}>{order.status === 'en_transito' ? 'En Tránsito' : 'Recibida Parcial'}</Badge></TableCell>
                                        {canReceive && (
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => handleStart(order)} disabled={startingId === order.id}>
                                                    {startingId === order.id ? 'Iniciando…' : 'Iniciar Recepción'}
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-6">No hay órdenes en tránsito por recibir.</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Recepciones</CardTitle>
                    <CardDescription>{receptions.length} recepciones registradas</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-24 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Recepción</TableHead>
                                    <TableHead>Orden</TableHead>
                                    <TableHead>Recibido por</TableHead>
                                    <TableHead>Verificado por</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Fecha</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {receptions.length > 0 ? receptions.map(rec => (
                                    <TableRow key={rec.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/logistics/recepciones/${rec.id}`)}>
                                        <TableCell className="font-medium">{rec.receptionNumber}</TableCell>
                                        <TableCell>{rec.purchaseOrderNumber}</TableCell>
                                        <TableCell>{rec.receivedBy?.name || '—'}</TableCell>
                                        <TableCell>{rec.verifiedBy?.name || '—'}</TableCell>
                                        <TableCell><Badge variant={RECEPTION_STATUS_VARIANT[rec.status]}>{RECEPTION_STATUS_LABELS[rec.status]}</Badge></TableCell>
                                        <TableCell>{format(new Date(rec.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">Aún no hay recepciones.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
