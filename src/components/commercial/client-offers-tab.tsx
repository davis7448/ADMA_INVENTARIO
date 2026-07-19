"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
    getPromotions, updatePromotionOutcome,
    PROMOTION_CHANNEL_LABELS, PROMOTION_TYPE_LABELS, PROMOTION_OUTCOME_LABELS,
    type ProductPromotion, type PromotionOutcome,
} from '@/app/actions/promotions';
import type { CommercialClient } from '@/types/commercial';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

// Historial de ofertas (difusión) del cliente + qué productos le funcionan,
// combinando pedidos embebidos, testeos y resultados de ofertas.
export function ClientOffersTab({ client }: { client: CommercialClient }) {
    const { toast } = useToast();
    const [promotions, setPromotions] = useState<ProductPromotion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!client.id) return;
        getPromotions({ clientId: client.id })
            .then(setPromotions)
            .catch(() => setPromotions([]))
            .finally(() => setIsLoading(false));
    }, [client.id]);

    const handleOutcomeChange = async (promo: ProductPromotion, outcome: PromotionOutcome) => {
        if (!promo.id) return;
        try {
            await updatePromotionOutcome(promo.id, outcome);
            setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, outcome } : p));
        } catch {
            toast({ title: 'Error', description: 'No se pudo actualizar el resultado.', variant: 'destructive' });
        }
    };

    // Fit de producto: qué le funciona (pedidos + ofertas con pedido/interesado,
    // testeos positivos) y qué no (rechazos, testeos negativos)
    const productFit = useMemo(() => {
        const works = new Map<string, { name: string; signals: string[] }>();
        const fails = new Map<string, { name: string; signals: string[] }>();

        const add = (map: Map<string, { name: string; signals: string[] }>, key: string, name: string, signal: string) => {
            const entry = map.get(key) || { name, signals: [] };
            if (!entry.signals.includes(signal)) entry.signals.push(signal);
            map.set(key, entry);
        };

        for (const order of client.orders || []) {
            for (const item of order.items || []) {
                add(works, item.product_id || item.product_name, item.product_name, `compró ${item.quantity}`);
            }
        }
        for (const test of client.tests || []) {
            const name = test.productName || test.product_name || '';
            const key = test.productId || test.product_id || name;
            if (!name) continue;
            if (test.result === 'positive') add(works, key, name, 'test positivo');
            if (test.result === 'negative') add(fails, key, name, 'test negativo');
        }
        for (const promo of promotions) {
            if (promo.outcome === 'pedido' || promo.outcome === 'interesado') {
                add(works, promo.productId, promo.productName, promo.outcome === 'pedido' ? 'pidió tras oferta' : 'mostró interés');
            }
            if (promo.outcome === 'rechazado') {
                add(fails, promo.productId, promo.productName, 'rechazó oferta');
            }
        }
        return { works: Array.from(works.values()), fails: Array.from(fails.values()) };
    }, [client.orders, client.tests, promotions]);

    return (
        <div className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><ThumbsUp className="h-4 w-4 text-green-600" />Le funcionan ({productFit.works.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        {productFit.works.length > 0 ? productFit.works.slice(0, 8).map((p, i) => (
                            <div key={i} className="text-sm">
                                <span className="font-medium">{p.name}</span>
                                <span className="text-xs text-muted-foreground"> — {p.signals.join(', ')}</span>
                            </div>
                        )) : <p className="text-sm text-muted-foreground">Sin señales aún.</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-destructive" />No le funcionan ({productFit.fails.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                        {productFit.fails.length > 0 ? productFit.fails.slice(0, 8).map((p, i) => (
                            <div key={i} className="text-sm">
                                <span className="font-medium">{p.name}</span>
                                <span className="text-xs text-muted-foreground"> — {p.signals.join(', ')}</span>
                            </div>
                        )) : <p className="text-sm text-muted-foreground">Sin señales negativas.</p>}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Ofertas realizadas</CardTitle>
                    <CardDescription>{promotions.length} registros de difusión a este cliente</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {isLoading ? <Skeleton className="h-24 w-full" /> : promotions.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>Canal</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Comercial</TableHead>
                                    <TableHead>Resultado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {promotions.map(promo => (
                                    <TableRow key={promo.id}>
                                        <TableCell className="whitespace-nowrap">{format(new Date(promo.date), 'dd MMM yyyy', { locale: es })}</TableCell>
                                        <TableCell className="font-medium max-w-[200px] truncate">{promo.productName}</TableCell>
                                        <TableCell><Badge variant="outline">{PROMOTION_CHANNEL_LABELS[promo.channel]}</Badge></TableCell>
                                        <TableCell><Badge variant="secondary">{PROMOTION_TYPE_LABELS[promo.promotionType]}</Badge></TableCell>
                                        <TableCell className="text-sm">{promo.commercialName}</TableCell>
                                        <TableCell>
                                            <Select value={promo.outcome || 'sin_respuesta'} onValueChange={(v) => handleOutcomeChange(promo, v as PromotionOutcome)}>
                                                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(PROMOTION_OUTCOME_LABELS).map(([value, label]) => (
                                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Aún no se le han registrado ofertas.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
