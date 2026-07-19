"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getProcessReportData, type ProcessReportData } from '@/app/actions/process-report';
import { PROMOTION_CHANNEL_LABELS, PROMOTION_OUTCOME_LABELS, PROMOTION_TYPE_LABELS } from '@/app/actions/promotions';
import { DEFAULT_CRM_CONFIG, daysSinceLastContact, getClientVolume, loadCrmConfig, type CrmConfig } from '@/lib/client-volume';
import { PackageOpen, Boxes, ClipboardList, Megaphone, Users } from 'lucide-react';

const RANGES = [
    { value: '30', label: 'Últimos 30 días' },
    { value: '90', label: 'Últimos 90 días' },
    { value: 'all', label: 'Todo el histórico' },
];

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' | 'bad' }) {
    const color = tone === 'ok' ? 'text-green-600' : tone === 'warn' ? 'text-amber-600' : tone === 'bad' ? 'text-destructive' : '';
    return (
        <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
    );
}

function toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

export function ReporteProcesoContent() {
    const { toast } = useToast();
    const [data, setData] = useState<ProcessReportData | null>(null);
    const [range, setRange] = useState('30');
    const [crmConfig, setCrmConfig] = useState<CrmConfig>(DEFAULT_CRM_CONFIG);

    useEffect(() => {
        loadCrmConfig().then(setCrmConfig);
        getProcessReportData()
            .then(setData)
            .catch(err => {
                console.error(err);
                toast({ title: 'Error', description: 'No se pudieron cargar los datos del reporte.', variant: 'destructive' });
            });
    }, []);

    const since = useMemo(() => {
        if (range === 'all') return null;
        const d = new Date();
        d.setDate(d.getDate() - Number(range));
        return d;
    }, [range]);

    const inRange = (value: any) => {
        if (!since) return true;
        const d = toDate(value);
        return d !== null && d >= since;
    };

    const report = useMemo(() => {
        if (!data) return null;

        // --- 1. Flujo de entrada (OC → recepción → liquidación) ---
        const orders = data.orders.filter(o => inRange(o.createdAt));
        const orderItems = data.orderItems.filter(i => inRange(i.createdAt));
        const ocPorEstado = new Map<string, number>();
        for (const o of orders) ocPorEstado.set(o.status, (ocPorEstado.get(o.status) || 0) + 1);
        const lineasPorEstado = new Map<string, number>();
        for (const i of orderItems) lineasPorEstado.set(i.status, (lineasPorEstado.get(i.status) || 0) + 1);

        // Tiempo documentada → recepción (por OC con recepción)
        const tiemposTransito: number[] = [];
        for (const rec of data.receptions) {
            const oc = data.orders.find(o => o.id === rec.purchaseOrderId);
            const d1 = oc ? toDate(oc.createdAt) : null;
            const d2 = toDate(rec.createdAt);
            if (d1 && d2 && inRange(rec.createdAt)) tiemposTransito.push((d2.getTime() - d1.getTime()) / 86400000);
        }
        const transitoPromedio = tiemposTransito.length ? tiemposTransito.reduce((a, b) => a + b, 0) / tiemposTransito.length : null;

        // Exactitud de recepción
        const recItems = data.receptionItems.filter(i => i.countedUnits !== undefined && inRange(i.createdAt));
        const discrepancias = recItems.filter(i => i.match === false);
        const unidadesEsperadas = recItems.reduce((a, i) => a + (i.expectedUnits || 0), 0);
        const unidadesContadas = recItems.reduce((a, i) => a + (i.countedUnits || 0), 0);

        // Precisión del costeo (líneas liquidadas con ambos costos)
        const liquidadas = data.orderItems.filter(i => i.unitCostFinal && i.unitCostEstimated);
        const desvios = liquidadas.map(i => Math.abs(i.unitCostFinal! - i.unitCostEstimated!) / i.unitCostEstimated! * 100);
        const desvioPromedio = desvios.length ? desvios.reduce((a, b) => a + b, 0) / desvios.length : null;

        // Contenido listo
        const contenidoListo = orderItems.filter(i => i.contentStatus === 'listo').length;

        // --- 2. Entradas a inventario ---
        const movs = data.entryMovements.filter(m => !since || (m.date && m.date >= since));
        const unidadesNuevas = movs.filter(m => m.entryType === 'nuevo').reduce((a, m) => a + m.quantity, 0);
        const unidadesRecarga = movs.filter(m => m.entryType === 'reabastecimiento').reduce((a, m) => a + m.quantity, 0);

        // --- 3. Solicitudes a plataformas ---
        const sols = data.solicitudes.filter(s => !since || (s.FECHA && s.FECHA >= since.getTime()));
        const solPorEstado = new Map<string, number>();
        const solPorTipo = new Map<string, number>();
        const solPorComercial = new Map<string, number>();
        let privatizar = 0, liberar = 0, retiros = 0;
        for (const s of sols) {
            solPorEstado.set(s.estadoSolicitud || '—', (solPorEstado.get(s.estadoSolicitud || '—') || 0) + 1);
            const tipo = s.tipoModificacion === 'CREACION_ITEM' ? 'Creación' : s.ES_RETIRO ? 'Retiro' : s.SOLICITUD === 'SUMA' ? 'Suma' : 'Ajuste';
            solPorTipo.set(tipo, (solPorTipo.get(tipo) || 0) + 1);
            const com = s.solicitadoPor?.name || s.COMERCIAL || '—';
            solPorComercial.set(com, (solPorComercial.get(com) || 0) + 1);
            if (s.ACCION_PRIVATIZACION === 'privatizar' || s.PRIVADO_PUBLICO === 'Privado') privatizar++;
            if (s.ACCION_PRIVATIZACION === 'quitar_privatizacion') liberar++;
            if (s.ES_RETIRO) retiros++;
        }
        const rechazadas = sols.filter(s => s.estadoSolicitud === 'rechazado').length;

        // --- 4. Difusión ---
        const promos = data.promotions.filter(p => !since || p.date >= since.getTime());
        const promoPorCanal = new Map<string, number>();
        const promoPorTipo = new Map<string, number>();
        const promoPorComercial = new Map<string, { total: number; pedidos: number }>();
        const promoPorProducto = new Map<string, { total: number; pedidos: number }>();
        const promoPorOutcome = new Map<string, number>();
        for (const p of promos) {
            promoPorCanal.set(p.channel, (promoPorCanal.get(p.channel) || 0) + 1);
            promoPorTipo.set(p.promotionType, (promoPorTipo.get(p.promotionType) || 0) + 1);
            promoPorOutcome.set(p.outcome || 'sin_respuesta', (promoPorOutcome.get(p.outcome || 'sin_respuesta') || 0) + 1);
            const c = promoPorComercial.get(p.commercialName) || { total: 0, pedidos: 0 };
            c.total++; if (p.outcome === 'pedido') c.pedidos++;
            promoPorComercial.set(p.commercialName, c);
            const pr = promoPorProducto.get(p.productName) || { total: 0, pedidos: 0 };
            pr.total++; if (p.outcome === 'pedido') pr.pedidos++;
            promoPorProducto.set(p.productName, pr);
        }
        const pedidosTotales = promos.filter(p => p.outcome === 'pedido').length;
        const conversion = promos.length ? (pedidosTotales / promos.length * 100) : null;

        // --- 5. Clientes ---
        const clientesNuevos = data.clients.filter(c => inRange(c.created_at)).length;
        const tiers = new Map<string, number>();
        let sinContacto = 0;
        for (const c of data.clients) {
            const tier = getClientVolume(c, crmConfig).tier;
            tiers.set(tier, (tiers.get(tier) || 0) + 1);
            const days = daysSinceLastContact(c);
            if (days !== null && days >= crmConfig.warnDays) sinContacto++;
        }

        return {
            orders, orderItems, ocPorEstado, lineasPorEstado, transitoPromedio,
            recItems, discrepancias, unidadesEsperadas, unidadesContadas,
            liquidadas, desvioPromedio, contenidoListo,
            movs, unidadesNuevas, unidadesRecarga,
            sols, solPorEstado, solPorTipo, solPorComercial, privatizar, liberar, retiros, rechazadas,
            promos, promoPorCanal, promoPorTipo, promoPorComercial, promoPorProducto, promoPorOutcome, pedidosTotales, conversion,
            clientesNuevos, tiers, sinContacto,
        };
    }, [data, since, crmConfig]);

    if (!data || !report) {
        return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
    }

    const pct = (num: number, den: number) => den > 0 ? `${(num / den * 100).toFixed(0)}%` : '—';
    const sortDesc = <T,>(map: Map<string, T>, val: (x: T) => number) =>
        Array.from(map.entries()).sort((a, b) => val(b[1]) - val(a[1]));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">KPIs del Proceso</h1>
                    <p className="text-muted-foreground">Entrada de mercancía, activaciones, difusión y clientes — de punta a punta.</p>
                </div>
                <div className="w-full sm:w-52">
                    <Select value={range} onValueChange={setRange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* 1. Flujo de entrada */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><PackageOpen className="h-4 w-4" />Flujo de Entrada (OC → Recepción → Liquidación)</CardTitle>
                    <CardDescription>{report.orders.length} órdenes · {report.orderItems.length} líneas en el periodo</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatTile label="Tiempo doc. → recepción" value={report.transitoPromedio !== null ? `${report.transitoPromedio.toFixed(1)} días` : '—'} hint="promedio por recepción" />
                        <StatTile
                            label="Exactitud de recepción"
                            value={report.recItems.length ? pct(report.recItems.length - report.discrepancias.length, report.recItems.length) : '—'}
                            hint={`${report.discrepancias.length} línea(s) con discrepancia`}
                            tone={report.discrepancias.length === 0 ? 'ok' : report.discrepancias.length / Math.max(1, report.recItems.length) > 0.2 ? 'bad' : 'warn'}
                        />
                        <StatTile
                            label="Unidades esperadas vs contadas"
                            value={`${report.unidadesContadas.toLocaleString('es-CO')} / ${report.unidadesEsperadas.toLocaleString('es-CO')}`}
                            hint={report.unidadesEsperadas > 0 ? `${pct(report.unidadesContadas, report.unidadesEsperadas)} recibido` : undefined}
                        />
                        <StatTile
                            label="Precisión del costeo"
                            value={report.desvioPromedio !== null ? `±${report.desvioPromedio.toFixed(1)}%` : '—'}
                            hint={`desvío estimado vs final (${report.liquidadas.length} líneas liquidadas)`}
                            tone={report.desvioPromedio === null ? undefined : report.desvioPromedio <= 5 ? 'ok' : report.desvioPromedio <= 15 ? 'warn' : 'bad'}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {Array.from(report.lineasPorEstado.entries()).map(([estado, n]) => (
                            <Badge key={estado} variant="outline">{estado}: {n}</Badge>
                        ))}
                        <Badge variant="secondary">contenido listo: {report.contenidoListo}</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Entradas a inventario */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4" />Entradas a Inventario</CardTitle>
                    <CardDescription>{report.movs.length} movimientos de entrada trazados en el periodo</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <StatTile label="Unidades de productos NUEVOS" value={report.unidadesNuevas.toLocaleString('es-CO')} />
                        <StatTile label="Unidades de REABASTECIMIENTO" value={report.unidadesRecarga.toLocaleString('es-CO')} />
                        <StatTile label="Proporción nuevo / recarga" value={report.unidadesNuevas + report.unidadesRecarga > 0 ? pct(report.unidadesNuevas, report.unidadesNuevas + report.unidadesRecarga) : '—'} hint="% de unidades que son producto nuevo" />
                    </div>
                </CardContent>
            </Card>

            {/* 3. Solicitudes a plataformas */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4" />Solicitudes a Plataformas</CardTitle>
                    <CardDescription>{report.sols.length} solicitudes en el periodo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatTile label="Privatizaciones" value={String(report.privatizar)} />
                        <StatTile label="Liberaciones (quitar privado)" value={String(report.liberar)} />
                        <StatTile label="Retiros / a cero" value={String(report.retiros)} hint="señal de rotación muerta" tone={report.retiros > 0 ? 'warn' : undefined} />
                        <StatTile label="Rechazadas" value={String(report.rechazadas)} tone={report.rechazadas > 0 ? 'warn' : 'ok'} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Array.from(report.solPorEstado.entries()).map(([estado, n]) => (
                            <Badge key={estado} variant="outline">{estado.replace('_', ' ')}: {n}</Badge>
                        ))}
                        {Array.from(report.solPorTipo.entries()).map(([tipo, n]) => (
                            <Badge key={tipo} variant="secondary">{tipo}: {n}</Badge>
                        ))}
                    </div>
                    {report.solPorComercial.size > 0 && (
                        <div className="text-sm">
                            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Por comercial</p>
                            {sortDesc(report.solPorComercial, x => x).slice(0, 6).map(([nombre, n]) => (
                                <span key={nombre} className="inline-block mr-3">{nombre}: <strong>{n}</strong></span>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 4. Difusión */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><Megaphone className="h-4 w-4" />Difusión Comercial</CardTitle>
                    <CardDescription>{report.promos.length} ofertas registradas en el periodo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatTile label="Ofertas totales" value={String(report.promos.length)} />
                        <StatTile label="Pedidos generados" value={String(report.pedidosTotales)} tone={report.pedidosTotales > 0 ? 'ok' : undefined} />
                        <StatTile label="Tasa de conversión" value={report.conversion !== null ? `${report.conversion.toFixed(1)}%` : '—'} hint="pedidos / ofertas" />
                        <StatTile label="Clientes sin contacto" value={String(report.sinContacto)} hint={`> ${crmConfig.warnDays} días`} tone={report.sinContacto > 0 ? 'warn' : 'ok'} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Array.from(report.promoPorCanal.entries()).map(([canal, n]) => (
                            <Badge key={canal} variant="outline">{PROMOTION_CHANNEL_LABELS[canal as keyof typeof PROMOTION_CHANNEL_LABELS] || canal}: {n}</Badge>
                        ))}
                        {Array.from(report.promoPorTipo.entries()).map(([tipo, n]) => (
                            <Badge key={tipo} variant="secondary">{PROMOTION_TYPE_LABELS[tipo as keyof typeof PROMOTION_TYPE_LABELS] || tipo}: {n}</Badge>
                        ))}
                        {Array.from(report.promoPorOutcome.entries()).map(([o, n]) => (
                            <Badge key={o} variant={o === 'pedido' ? 'default' : 'outline'}>{PROMOTION_OUTCOME_LABELS[o as keyof typeof PROMOTION_OUTCOME_LABELS] || o}: {n}</Badge>
                        ))}
                    </div>
                    {(report.promoPorComercial.size > 0 || report.promoPorProducto.size > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Por comercial (ofertas → pedidos)</p>
                                <Table>
                                    <TableBody>
                                        {sortDesc(report.promoPorComercial, x => x.total).slice(0, 6).map(([nombre, v]) => (
                                            <TableRow key={nombre}>
                                                <TableCell className="py-1.5">{nombre}</TableCell>
                                                <TableCell className="py-1.5 text-right">{v.total} → <strong>{v.pedidos}</strong> ({pct(v.pedidos, v.total)})</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Top productos difundidos</p>
                                <Table>
                                    <TableBody>
                                        {sortDesc(report.promoPorProducto, x => x.total).slice(0, 6).map(([nombre, v]) => (
                                            <TableRow key={nombre}>
                                                <TableCell className="py-1.5 max-w-[220px] truncate">{nombre}</TableCell>
                                                <TableCell className="py-1.5 text-right">{v.total} → <strong>{v.pedidos}</strong></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 5. Clientes */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Clientes</CardTitle>
                    <CardDescription>{data.clients.length} clientes en el CRM</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <StatTile label="Nuevos en el periodo" value={String(report.clientesNuevos)} tone={report.clientesNuevos > 0 ? 'ok' : undefined} />
                        <StatTile label="Tier A" value={String(report.tiers.get('A') || 0)} hint={`≥ $${(crmConfig.tierAThreshold / 1e6).toFixed(1)}M en pedidos`} />
                        <StatTile label="Tier B" value={String(report.tiers.get('B') || 0)} />
                        <StatTile label="Tier C" value={String(report.tiers.get('C') || 0)} />
                        <StatTile label="Sin compras" value={String(report.tiers.get('Nuevo') || 0)} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
