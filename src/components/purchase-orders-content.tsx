"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { createPurchaseOrderAction, getPurchaseOrdersAction } from '@/app/actions/purchase-orders';
import type { PurchaseOrder, PurchaseOrderStatus, Supplier, Warehouse } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
    documentada: 'Documentada',
    en_transito: 'En Tránsito',
    recibida_parcial: 'Recibida Parcial',
    recibida: 'Recibida',
    liquidada: 'Liquidada',
    cerrada: 'Cerrada',
};

const PO_STATUS_VARIANT: Record<PurchaseOrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    documentada: 'secondary',
    en_transito: 'default',
    recibida_parcial: 'outline',
    recibida: 'outline',
    liquidada: 'outline',
    cerrada: 'secondary',
};

interface PurchaseOrdersContentProps {
    suppliers: Supplier[];
    warehouses: Warehouse[];
}

export function PurchaseOrdersContent({ suppliers, warehouses }: PurchaseOrdersContentProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Formulario de nueva OC
    const [supplierId, setSupplierId] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const [groupackRef, setGroupackRef] = useState('');
    const [eta, setEta] = useState('');
    const [notes, setNotes] = useState('');

    const canCreate = user && ['admin', 'coordinacion'].includes(user.role);

    const loadOrders = async () => {
        setIsLoading(true);
        try {
            setOrders(await getPurchaseOrdersAction());
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudieron cargar las órdenes de compra.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadOrders(); }, []);

    const filteredOrders = useMemo(
        () => statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter),
        [orders, statusFilter]
    );

    const supplierName = (id?: string) => suppliers.find(s => s.id === id)?.name || '—';
    const warehouseName = (id?: string) => warehouses.find(w => w.id === id)?.name || '—';

    const handleCreate = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            const result = await createPurchaseOrderAction({
                supplierId: supplierId || undefined,
                warehouseId: warehouseId || undefined,
                groupackRef: groupackRef.trim() || undefined,
                estimatedArrivalDate: eta || undefined,
                notes: notes.trim() || undefined,
                createdBy: { id: user.id, name: user.name },
            });
            if (result.success && result.id) {
                toast({ title: '¡Éxito!', description: `Orden ${result.orderNumber} creada.` });
                setDialogOpen(false);
                setSupplierId(''); setWarehouseId(''); setGroupackRef(''); setEta(''); setNotes('');
                router.push(`/compras/${result.id}`);
            } else {
                toast({ title: 'Error', description: result.error || 'No se pudo crear la orden.', variant: 'destructive' });
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Mercancía por Llegar</h1>
                    <p className="text-muted-foreground">Órdenes de compra: documentación, tránsito y recepción.</p>
                </div>
                {canCreate && (
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>Nueva Orden de Compra</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[480px]">
                            <DialogHeader>
                                <DialogTitle>Nueva Orden de Compra</DialogTitle>
                                <DialogDescription>Documenta la mercancía que viene en camino. Las líneas (SKU) se agregan en el detalle.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-2">
                                <div>
                                    <Label>Proveedor</Label>
                                    <Select value={supplierId} onValueChange={setSupplierId}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar proveedor…" /></SelectTrigger>
                                        <SelectContent>
                                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Bodega destino</Label>
                                    <Select value={warehouseId} onValueChange={setWarehouseId}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar bodega…" /></SelectTrigger>
                                        <SelectContent>
                                            {warehouses.filter(w => w.type !== 'external').map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="po-groupack">Referencia Groupack (opcional)</Label>
                                    <Input id="po-groupack" value={groupackRef} onChange={e => setGroupackRef(e.target.value)} placeholder="Ej: CONT-2026-014 / cotización" className="mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="po-eta">Fecha estimada de llegada</Label>
                                    <Input id="po-eta" type="date" value={eta} onChange={e => setEta(e.target.value)} className="mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="po-notes">Notas</Label>
                                    <Textarea id="po-notes" value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 resize-none h-16" />
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                                <Button onClick={handleCreate} disabled={isSaving}>{isSaving ? 'Creando…' : 'Crear Orden'}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Órdenes de Compra</CardTitle>
                            <CardDescription>{filteredOrders.length} órdenes</CardDescription>
                        </div>
                        <div className="w-full sm:w-56">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los estados</SelectItem>
                                    {Object.entries(PO_STATUS_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Orden</TableHead>
                                <TableHead>Proveedor</TableHead>
                                <TableHead>Bodega</TableHead>
                                <TableHead>Ref. Groupack</TableHead>
                                <TableHead>Llegada Est.</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Creada por</TableHead>
                                <TableHead>Fecha</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredOrders.length > 0 ? (
                                filteredOrders.map(order => (
                                    <TableRow
                                        key={order.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/compras/${order.id}`)}
                                    >
                                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                                        <TableCell>{supplierName(order.supplierId)}</TableCell>
                                        <TableCell>{warehouseName(order.warehouseId)}</TableCell>
                                        <TableCell>{order.groupackRef || '—'}</TableCell>
                                        <TableCell>{order.estimatedArrivalDate ? format(new Date(order.estimatedArrivalDate + 'T00:00:00'), 'dd MMM yyyy', { locale: es }) : '—'}</TableCell>
                                        <TableCell>
                                            <Badge variant={PO_STATUS_VARIANT[order.status]}>{PO_STATUS_LABELS[order.status]}</Badge>
                                        </TableCell>
                                        <TableCell>{order.createdBy?.name || '—'}</TableCell>
                                        <TableCell>{format(new Date(order.createdAt), 'dd MMM yyyy', { locale: es })}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        No hay órdenes de compra{statusFilter !== 'all' ? ' en este estado' : ''}.
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
