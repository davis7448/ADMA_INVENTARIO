"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getPurchaseOrderAction, liquidatePurchaseOrderAction } from '@/app/actions/purchase-orders';
import { PO_STATUS_LABELS } from './purchase-orders-content';
import type { PurchaseOrder, PurchaseOrderItem } from '@/lib/types';
import { ArrowLeft, Calculator } from 'lucide-react';

const formatCOP = (value?: number) =>
    value === undefined || value === null ? '—' : `$${value.toLocaleString('es-CO')}`;

export function LiquidationContent({ orderId }: { orderId: string }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [items, setItems] = useState<PurchaseOrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [finalCosts, setFinalCosts] = useState<Record<string, string>>({});

    const canLiquidate = !!user && ['admin', 'coordinacion'].includes(user.role);

    const load = async () => {
        setIsLoading(true);
        try {
            const result = await getPurchaseOrderAction(orderId);
            setOrder(result.order);
            setItems(result.items);
            // Prellenar con costo final ya guardado o con el estimado
            const initial: Record<string, string> = {};
            for (const item of result.items) {
                const value = item.unitCostFinal ?? item.unitCostEstimated;
                if (value !== undefined) initial[item.id] = String(value);
            }
            setFinalCosts(initial);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudo cargar la orden.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, [orderId]);

    const rows = useMemo(() => items.map(item => {
        const raw = finalCosts[item.id];
        const finalCost = raw === undefined || raw === '' ? undefined : Number(raw);
        const delta = (finalCost !== undefined && item.unitCostEstimated)
            ? finalCost - item.unitCostEstimated
            : undefined;
        const deltaPct = (delta !== undefined && item.unitCostEstimated)
            ? (delta / item.unitCostEstimated) * 100
            : undefined;
        return { item, finalCost, delta, deltaPct };
    }), [items, finalCosts]);

    const readyRows = rows.filter(r => r.finalCost !== undefined && Number.isFinite(r.finalCost) && r.finalCost! > 0);
    const totalFinal = readyRows.reduce((acc, r) => acc + r.finalCost! * (r.item.receivedUnits ?? r.item.expectedUnits), 0);

    const handleLiquidate = async () => {
        if (!user) return;
        if (readyRows.length === 0) {
            toast({ title: 'Error', description: 'Ingresa el costo final de al menos una línea.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            const result = await liquidatePurchaseOrderAction(
                orderId,
                readyRows.map(r => ({ itemId: r.item.id, unitCostFinal: r.finalCost! })),
                user
            );
            if (result.success) {
                const skipped = result.skippedSkus?.length
                    ? ` SKUs sin producto para actualizar costo: ${result.skippedSkus.join(', ')}.`
                    : '';
                toast({
                    title: '¡Liquidación aplicada!',
                    description: `${result.liquidated} línea(s) liquidada(s), costo actualizado en ${result.productsUpdated} producto(s).${skipped}`,
                });
                load();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
    }

    if (!order) {
        return (
            <div className="text-center space-y-4 py-12">
                <p className="text-muted-foreground">La orden de compra no existe.</p>
                <Button variant="outline" onClick={() => router.push('/compras')}><ArrowLeft className="h-4 w-4 mr-2" />Volver</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/compras/${orderId}`)}><ArrowLeft className="h-5 w-5" /></Button>
                    <div>
                        <h1 className="text-2xl font-bold font-headline tracking-tight">Liquidación — {order.orderNumber}</h1>
                        <p className="text-muted-foreground text-sm">
                            Registra el costo final unitario por SKU (desde el Excel de Groupack). Actualiza el costo del producto y recalcula precios.
                        </p>
                    </div>
                </div>
                <Badge>{PO_STATUS_LABELS[order.status]}</Badge>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Costos Finales</CardTitle>
                            <CardDescription>
                                {readyRows.length} de {items.length} líneas con costo · Total liquidado: {formatCOP(Math.round(totalFinal))}
                            </CardDescription>
                        </div>
                        {canLiquidate && (
                            <Button onClick={handleLiquidate} disabled={isSaving || readyRows.length === 0}>
                                {isSaving ? 'Aplicando…' : 'Confirmar Liquidación'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>SKU</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right">Unidades</TableHead>
                                <TableHead className="text-right">Costo Estimado</TableHead>
                                <TableHead className="text-right">Costo Final</TableHead>
                                <TableHead className="text-right">Delta</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length > 0 ? rows.map(({ item, delta, deltaPct }) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                    <TableCell className="text-right">{(item.receivedUnits ?? item.expectedUnits).toLocaleString('es-CO')}</TableCell>
                                    <TableCell className="text-right">{formatCOP(item.unitCostEstimated)}</TableCell>
                                    <TableCell className="text-right">
                                        {canLiquidate ? (
                                            <Input
                                                type="number" min="0"
                                                value={finalCosts[item.id] ?? ''}
                                                onChange={e => setFinalCosts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                className="w-32 h-8 text-right ml-auto"
                                            />
                                        ) : formatCOP(item.unitCostFinal)}
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap">
                                        {delta !== undefined ? (
                                            <span className={delta > 0 ? 'text-destructive' : delta < 0 ? 'text-green-600' : 'text-muted-foreground'}>
                                                {delta > 0 ? '+' : ''}{formatCOP(Math.round(delta))}
                                                {deltaPct !== undefined ? ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)` : ''}
                                            </span>
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={item.status === 'liquidada' || item.status === 'activada' ? 'default' : 'outline'}>
                                            {item.status === 'liquidada' ? 'Liquidada' : item.status === 'activada' ? 'Activada' : 'Pendiente'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">La orden no tiene líneas.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
