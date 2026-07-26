"use client";

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
    parseDropiRows, importPlatformSales, getReportMonths, getUnmappedItems,
    getSalesByMonthAndCommercial, getAssignmentConsumption, saveManualMapping,
    getUnmappedTiendas, saveTiendaMapping, getSalesBreakdown, getBaseUnitConsumption, getUnlinkedSkuItems,
    getDistinctCommercials, saveCommercialAlias,
    type ImportSummary, type ReportMonth,
} from '@/lib/platform-sales';
import { loadCrmConfig } from '@/lib/client-volume';
import { parseEffiFiles } from '@/lib/effi';
import { syncVenndeloAction } from '@/app/actions/venndelo';
import { ProductSearchPicker } from '@/components/product-search-picker';
import { AlertTriangle, FileUp, Link2, Upload } from 'lucide-react';

const PLATFORMS = ['DROPI', 'VENNDELO', 'EFFI'];
const BODEGAS = ['INGENIO', 'LABORATORIO', 'IMPORTACIONES', 'OTRA'];
const PAISES_VENTA = ['COLOMBIA', 'MEXICO', 'ECUADOR', 'PARAGUAY', 'ARGENTINA', 'GUATEMALA'];
type Breakdown = Map<string, Map<string, { ventas: number; total: number }>>;

export function VentasPlataformasContent() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [platform, setPlatform] = useState('DROPI');
    const [bodega, setBodega] = useState('INGENIO');
    const [bodegaOtra, setBodegaOtra] = useState('');
    const [pais, setPais] = useState('COLOMBIA');
    const [file, setFile] = useState<File | null>(null);
    // EFFI necesita dos archivos: alistamiento (.xls HTML) y guías (.xlsx)
    const [effiAlist, setEffiAlist] = useState<File | null>(null);
    const [effiGuias, setEffiGuias] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [progressMsg, setProgressMsg] = useState('');
    const [summary, setSummary] = useState<ImportSummary | null>(null);

    const [months, setMonths] = useState<ReportMonth[]>([]);
    const [byMonthCommercial, setByMonthCommercial] = useState<Map<string, Map<string, { ventas: number; total: number; activaciones: number; reactivaciones: number; publicas: number }>>>(new Map());
    const [unmapped, setUnmapped] = useState<Array<{ itemId: string; ventas: number; entregadas: number; productName?: string; variantName?: string; motivo: 'sin_mapeo' | 'sin_cliente' }>>([]);
    const [consumption, setConsumption] = useState<Array<{ itemId: string; productName?: string; clientEmail?: string; assignedQty: number; soldQty: number; pct: number }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mappingItem, setMappingItem] = useState<string | null>(null);
    const [unmappedTiendas, setUnmappedTiendas] = useState<Array<{ tienda: string; ventas: number }>>([]);
    const [byBodega, setByBodega] = useState<Breakdown>(new Map());
    const [byPais, setByPais] = useState<Breakdown>(new Map());
    const [baseUnits, setBaseUnits] = useState<Array<{ productName: string; ordenes: number; unidadesBase: number; tieneCombo: boolean }>>([]);
    const [unlinkedSku, setUnlinkedSku] = useState<Array<{ itemId: string; sku?: string; productName?: string; entregadas: number }>>([]);
    const [comerciales, setComerciales] = useState<Array<{ raw: string; canonical: string; ventas: number }>>([]);
    const [tiendaDialog, setTiendaDialog] = useState<string | null>(null);
    const [tiendaEmail, setTiendaEmail] = useState('');
    // Selector de periodo (meses seleccionados). Vacío = todos.
    const [periodo, setPeriodo] = useState<string[]>([]);
    // Colas de revisión: se cargan bajo demanda (son pesadas)
    const [colasCargadas, setColasCargadas] = useState(false);
    const [cargandoColas, setCargandoColas] = useState(false);
    const [isSyncingVenndelo, setIsSyncingVenndelo] = useState(false);
    const [venndeloResumen, setVenndeloResumen] = useState<string>('');

    const canImport = !!user && ['admin', 'coordinacion', 'commercial_director', 'plataformas'].includes(user.role);

    // Carga RÁPIDA: resúmenes por mes (pre-agregados) + meses disponibles
    const loadResumen = async (periodoSel?: string[]) => {
        setIsLoading(true);
        try {
            const [m, s, b] = await Promise.all([
                getReportMonths(),
                getSalesByMonthAndCommercial(periodoSel),
                getSalesBreakdown(periodoSel),
            ]);
            setMonths(m); setByMonthCommercial(s);
            setByBodega(b.byBodega); setByPais(b.byPais);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Carga PESADA (bajo demanda): colas de revisión que escanean ventas
    const loadColas = async () => {
        setCargandoColas(true);
        try {
            const [u, c, t, bu, usk, dc] = await Promise.all([
                getUnmappedItems(platform),
                getAssignmentConsumption(platform),
                getUnmappedTiendas(platform),
                getBaseUnitConsumption(platform),
                getUnlinkedSkuItems(platform),
                getDistinctCommercials(),
            ]);
            setUnmapped(u); setConsumption(c); setUnmappedTiendas(t); setBaseUnits(bu); setUnlinkedSku(usk); setComerciales(dc);
            setColasCargadas(true);
        } catch (error) {
            console.error(error);
        } finally {
            setCargandoColas(false);
        }
    };

    const handleVenndeloSync = async () => {
        setIsSyncingVenndelo(true);
        setVenndeloResumen('');
        try {
            const r = await syncVenndeloAction(30);
            if (r.success) {
                const res = r.resumen;
                setVenndeloResumen(res.filas === 0 ? 'Sin órdenes nuevas.' : `${res.nuevas} nuevas · ${res.actualizadas} actualizadas · ${res.entregadas} entregadas · ${res.skusVinculados} SKUs vinculados`);
                toast({ title: '¡Venndelo sincronizado!', description: `${res.filas || 0} líneas procesadas.` });
                await loadResumen(periodo.length ? periodo : undefined);
                if (colasCargadas) await loadColas();
            } else {
                toast({ title: 'Error', description: r.error, variant: 'destructive' });
            }
        } finally {
            setIsSyncingVenndelo(false);
        }
    };

    const loadData = async () => { await loadResumen(periodo.length ? periodo : undefined); };

    useEffect(() => { loadResumen(); }, [platform]);
    useEffect(() => { loadResumen(periodo.length ? periodo : undefined); }, [periodo]);

    const handleImport = async () => {
        // --- EFFI: dos archivos (alistamiento HTML/latin1 + guías xlsx) ---
        if (platform === 'EFFI') {
            if (!effiAlist || !effiGuias) {
                toast({ title: 'Faltan archivos', description: 'EFFI requiere cargar AMBOS: el reporte de alistamiento y el de guías de transporte.', variant: 'destructive' });
                return;
            }
            setIsImporting(true);
            setSummary(null);
            try {
                // Alistamiento: es HTML en latin1 → decodificar y parsear como string
                const alistStr = new TextDecoder('iso-8859-1').decode(await effiAlist.arrayBuffer());
                const wbA = XLSX.read(alistStr, { type: 'string' });
                const alistRows = XLSX.utils.sheet_to_json<any[]>(wbA.Sheets[wbA.SheetNames[0]], { header: 1, raw: false, defval: '' });
                // Guías: xlsx normal
                const wbG = XLSX.read(await effiGuias.arrayBuffer());
                const guiasRows = XLSX.utils.sheet_to_json<any[]>(wbG.Sheets[wbG.SheetNames[0]], { header: 1, raw: true, defval: '' });

                const parsed = parseEffiFiles(alistRows as any[][], guiasRows as any[][]);
                if (parsed.length === 0) {
                    toast({ title: 'Sin datos', description: 'No se encontraron guías. Verifica que subiste los archivos correctos.', variant: 'destructive' });
                    return;
                }
                const config = await loadCrmConfig();
                const result = await importPlatformSales('EFFI', parsed, (config as any).reactivationDays || 45, { bodega: 'INGENIO', pais: 'COLOMBIA' }, setProgressMsg);
                setSummary(result);
                toast({ title: '¡EFFI importado!', description: `${result.nuevas} nuevas · ${result.actualizadas} actualizadas · ${result.entregadas} entregadas.` });
                setEffiAlist(null); setEffiGuias(null);
                await loadResumen(periodo.length ? periodo : undefined);
                if (colasCargadas) await loadColas();
            } catch (error) {
                console.error(error);
                toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo importar EFFI.', variant: 'destructive' });
            } finally {
                setIsImporting(false);
                setProgressMsg('');
            }
            return;
        }

        if (!file) {
            toast({ title: 'Error', description: 'Selecciona el archivo del reporte de despachos.', variant: 'destructive' });
            return;
        }
        if (platform !== 'DROPI') {
            toast({ title: 'Próximamente', description: 'Por ahora solo está soportado el formato de Dropi (98% del volumen).', variant: 'destructive' });
            return;
        }
        setIsImporting(true);
        setSummary(null);
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false });

            const { parsed, errors } = parseDropiRows(rows as any[][]);
            if (errors.length > 0 && parsed.length === 0) {
                toast({ title: 'Archivo no reconocido', description: errors.join(' '), variant: 'destructive' });
                return;
            }

            const config = await loadCrmConfig();
            const bodegaFinal = bodega === 'OTRA' ? (bodegaOtra.trim() || undefined) : bodega;
            const result = await importPlatformSales(platform, parsed, (config as any).reactivationDays || 45, { bodega: bodegaFinal, pais }, setProgressMsg);
            setSummary(result);
            toast({
                title: '¡Importación completada!',
                description: `${result.nuevas} nuevas, ${result.actualizadas} actualizadas · ${result.entregadas} entregadas · ${result.ofertasConvertidas} oferta(s) marcadas como pedido.`,
            });
            setFile(null);
            await loadResumen(periodo.length ? periodo : undefined);
            if (colasCargadas) await loadColas();
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo importar.', variant: 'destructive' });
        } finally {
            setIsImporting(false);
            setProgressMsg('');
        }
    };

    const openMonths = months.filter(m => !m.closed);
    // Un mes puede tener varios docs (uno por plataforma). Fusionar por mes para:
    // el TOTAL del mes, el desglose por plataforma, el selector y el badge de cierre.
    const { mesesResumen, totalByMonth, byMonthPlatform } = useMemo(() => {
        const totalMap = new Map<string, { ventas: number; total: number; pendingOrders: number; closed: boolean }>();
        const platformMap = new Map<string, Map<string, { ventas: number; total: number }>>();
        for (const m of months) {
            const t = totalMap.get(m.month) || { ventas: 0, total: 0, pendingOrders: 0, closed: true };
            t.ventas += m.entregadas || 0;
            t.total += m.ingresoTotal || 0;
            t.pendingOrders += m.pendingOrders || 0;
            t.closed = t.closed && m.closed;
            totalMap.set(m.month, t);

            if (!platformMap.has(m.month)) platformMap.set(m.month, new Map());
            const pm = platformMap.get(m.month)!;
            const e = pm.get(m.platform) || { ventas: 0, total: 0 };
            e.ventas += m.entregadas || 0;
            e.total += m.ingresoTotal || 0;
            pm.set(m.platform, e);
        }
        const lista = Array.from(totalMap.entries())
            .map(([month, v]) => ({ month, pendingOrders: v.pendingOrders, closed: v.closed }))
            .sort((a, b) => b.month.localeCompare(a.month));
        return { mesesResumen: lista, totalByMonth: totalMap, byMonthPlatform: platformMap };
    }, [months]);
    const sortedMonths = useMemo(() => Array.from(byMonthCommercial.keys()).sort().reverse(), [byMonthCommercial]);
    const sobreventas = consumption.filter(c => c.pct > 100);
    const porAgotarse = consumption.filter(c => c.pct >= 80 && c.pct <= 100);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Ventas de Plataformas</h1>
                    <p className="text-muted-foreground">Los resúmenes se calculan al importar; la vista carga al instante.</p>
                </div>
                <div className="w-full sm:w-64">
                    <Label className="text-xs">Periodo</Label>
                    <Select
                        value={periodo.length === 1 ? periodo[0] : periodo.length === 0 ? 'todos' : 'varios'}
                        onValueChange={(v) => setPeriodo(v === 'todos' ? [] : [v])}
                    >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos los meses</SelectItem>
                            {mesesResumen.map(m => (
                                <SelectItem key={m.month} value={m.month}>{m.month}{m.pendingOrders > 0 ? ' (sin cerrar)' : ''}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Alertas de reportes */}
            {openMonths.length > 0 && (
                <div className="border border-amber-500/50 bg-amber-500/5 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium">Meses sin cerrar — hay que re-subir el reporte actualizado</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {openMonths.map(m => `${m.platform} ${m.month}: ${m.pendingOrders} órdenes en tránsito/pendientes`).join(' · ')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Un mes cierra cuando todas sus órdenes quedan en estado final (entregado, devolución, cancelado o rechazado). Vuelve a subir el reporte cuando las plataformas actualicen los estados.</p>
                    </div>
                </div>
            )}

            {/* Sincronizar Venndelo por API */}
            {canImport && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" />Venndelo — Sincronización automática</CardTitle>
                        <CardDescription>Trae las órdenes de Venndelo por API (bodega INGENIO, país COLOMBIA). El cron lo hace solo cada día; este botón sincroniza ahora.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3">
                            <Button onClick={handleVenndeloSync} disabled={isSyncingVenndelo}>
                                {isSyncingVenndelo ? 'Sincronizando…' : 'Sincronizar Venndelo (30 días)'}
                            </Button>
                            {venndeloResumen && <span className="text-sm text-muted-foreground">{venndeloResumen}</span>}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Importar */}
            {canImport && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base"><FileUp className="h-4 w-4" />Importar Reporte de Despachos</CardTitle>
                        <CardDescription>
                            {platform === 'EFFI'
                                ? 'EFFI requiere DOS archivos (alistamiento + guías); se cruzan por ID guía. Bodega INGENIO · País COLOMBIA. Se deduplica por guía.'
                                : 'Se deduplica por número de guía: puedes subir el mismo periodo varias veces y solo se actualizan los estados.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                            <div>
                                <Label>Plataforma</Label>
                                <Select value={platform} onValueChange={setPlatform}>
                                    <SelectTrigger className="w-32 mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            {platform !== 'EFFI' && (
                                <div>
                                    <Label>Bodega del reporte</Label>
                                    <Select value={bodega} onValueChange={setBodega}>
                                        <SelectTrigger className="w-40 mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {BODEGAS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {bodega === 'OTRA' && <Input value={bodegaOtra} onChange={e => setBodegaOtra(e.target.value)} placeholder="Nombre de la bodega" className="mt-1 w-40" />}
                                </div>
                            )}
                            {platform !== 'EFFI' && (
                                <div>
                                    <Label>País</Label>
                                    <Select value={pais} onValueChange={setPais}>
                                        <SelectTrigger className="w-36 mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {PAISES_VENTA.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {platform === 'EFFI' ? (
                                <>
                                    <div className="flex-1 w-full">
                                        <Label htmlFor="effi-alist">1) Reporte de alistamiento (.xls)</Label>
                                        <Input id="effi-alist" type="file" accept=".xls,.xlsx,.htm,.html" className="mt-1" onChange={e => setEffiAlist(e.target.files?.[0] || null)} />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <Label htmlFor="effi-guias">2) Guías de transporte (.xlsx)</Label>
                                        <Input id="effi-guias" type="file" accept=".xlsx,.xls" className="mt-1" onChange={e => setEffiGuias(e.target.files?.[0] || null)} />
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 w-full">
                                    <Label htmlFor="sales-file">Archivo (.xlsx)</Label>
                                    <Input id="sales-file" type="file" accept=".xlsx,.xls" className="mt-1" onChange={e => setFile(e.target.files?.[0] || null)} />
                                </div>
                            )}
                            <Button onClick={handleImport} disabled={isImporting || (platform === 'EFFI' ? (!effiAlist || !effiGuias) : !file)}>
                                <Upload className="h-4 w-4 mr-2" />{isImporting ? (progressMsg || 'Importando…') : 'Importar'}
                            </Button>
                        </div>
                        {summary && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                <Badge variant="outline">{summary.total} órdenes en el archivo</Badge>
                                <Badge variant="outline">{summary.nuevas} nuevas · {summary.actualizadas} actualizadas</Badge>
                                <Badge variant="default">{summary.entregadas} entregadas</Badge>
                                <Badge variant="secondary">{summary.atribuidas} atribuidas a cliente</Badge>
                                <Badge variant="secondary">{summary.publicas} públicas</Badge>
                                {summary.sinMapear > 0 && <Badge variant="destructive">{summary.sinMapear} sin mapear</Badge>}
                                {summary.sobreCupo > 0 && <Badge variant="destructive">{summary.sobreCupo} sobre cupo (exceden lo solicitado)</Badge>}
                                {summary.posiblesCompartidas > 0 && <Badge variant="secondary">{summary.posiblesCompartidas} posibles compartidas (vincula tiendas para precisar)</Badge>}
                                {summary.tiendasAprendidas > 0 && <Badge variant="outline">{summary.tiendasAprendidas} tiendas aprendidas</Badge>}
                                {summary.skusVinculados > 0 && <Badge variant="outline">{summary.skusVinculados} SKUs vinculados a inventario</Badge>}
                                <Badge variant="outline">{summary.mapeosCreados} mapeos creados</Badge>
                                <Badge variant="default">{summary.ofertasConvertidas} ofertas → pedido</Badge>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Unificar comerciales */}
            {(() => {
                const gruposConVariantes = new Map<string, string[]>();
                for (const c of comerciales) {
                    if (!gruposConVariantes.has(c.canonical)) gruposConVariantes.set(c.canonical, []);
                    gruposConVariantes.get(c.canonical)!.push(c.raw);
                }
                const canonicos = Array.from(new Set(comerciales.map(c => c.canonical))).sort();
                return canImport && comerciales.length > 0 ? (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Unificar Comerciales ({comerciales.length} nombres)</CardTitle>
                            <CardDescription>
                                Las mayúsculas/tildes ya se fusionan solas. Para nombres distintos del mismo comercial
                                (ej: "Maryori Victoria" = "Maryori"), escribe el nombre unificado. No re-importa nada.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <datalist id="canon-comerciales">
                                {canonicos.map(cn => <option key={cn} value={cn} />)}
                            </datalist>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nombre en los datos</TableHead>
                                        <TableHead className="text-right">Ventas</TableHead>
                                        <TableHead>Se muestra como</TableHead>
                                        <TableHead>Unificar como</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {comerciales.map(com => (
                                        <ComercialAliasRow key={com.raw} com={com} onSaved={loadData} />
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                ) : null;
            })()}

            {/* Resumen por mes: TOTAL + desglose por plataforma, comercial y país */}
            {isLoading ? (
                <Skeleton className="h-64 w-full" />
            ) : sortedMonths.length > 0 ? (
                <div className="space-y-4">
                    {sortedMonths.map(month => (
                        <MonthSummaryCard
                            key={month}
                            month={month}
                            total={totalByMonth.get(month)}
                            plataforma={byMonthPlatform.get(month)}
                            comercial={byMonthCommercial.get(month)}
                            pais={byPais.get(month)}
                        />
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="py-8">
                        <p className="text-sm text-muted-foreground text-center">Aún no hay ventas en el periodo seleccionado. Sube un reporte de Dropi o sincroniza Venndelo.</p>
                    </CardContent>
                </Card>
            )}

            {/* Colas de revisión (bajo demanda — escanean todas las ventas) */}
            {!colasCargadas ? (
                <Card>
                    <CardContent className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div>
                            <p className="font-medium">Colas de revisión y consumo</p>
                            <p className="text-sm text-muted-foreground">Items/tiendas sin vincular, SKU sin cruce, asignado vs vendido y consumo por unidad base. Requiere escanear todas las ventas.</p>
                        </div>
                        <Button onClick={loadColas} disabled={cargandoColas}>
                            {cargandoColas ? 'Cargando…' : 'Cargar revisión'}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
            <>
            {/* Asignado vs vendido */}
            {(sobreventas.length > 0 || porAgotarse.length > 0) && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Stock Asignado vs Vendido (items privados)</CardTitle>
                        <CardDescription>1 orden entregada ≈ 1 unidad. Sobreventas y asignaciones por agotarse.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>Cliente (correo)</TableHead>
                                    <TableHead className="text-right">Vendido / Asignado</TableHead>
                                    <TableHead>Señal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...sobreventas, ...porAgotarse].slice(0, 15).map(c => (
                                    <TableRow key={c.itemId}>
                                        <TableCell className="font-mono text-xs">{c.itemId}</TableCell>
                                        <TableCell className="max-w-[220px] truncate">{c.productName || '—'}</TableCell>
                                        <TableCell className="max-w-[180px] truncate">{c.clientEmail || '—'}</TableCell>
                                        <TableCell className="text-right">{c.soldQty} / {c.assignedQty} ({c.pct.toFixed(0)}%)</TableCell>
                                        <TableCell>
                                            {c.pct > 100
                                                ? <Badge variant="destructive">Sobreventa — revisar</Badge>
                                                : <Badge variant="default">Recarga próxima</Badge>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Consumo de inventario en unidades base */}
            {baseUnits.some(b => b.tieneCombo) && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Consumo de Inventario (unidades base)</CardTitle>
                        <CardDescription>Órdenes entregadas × factor del combo. Muestra cuántas unidades reales del producto se despacharon (los combos x2/x3 cuentan doble/triple).</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Órdenes</TableHead>
                                    <TableHead className="text-right">Unidades base</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {baseUnits.filter(b => b.tieneCombo || b.unidadesBase !== b.ordenes).slice(0, 20).map(b => (
                                    <TableRow key={b.productName}>
                                        <TableCell className="max-w-[280px] truncate">{b.productName} {b.tieneCombo && <Badge variant="secondary" className="ml-1 text-[10px]">combo</Badge>}</TableCell>
                                        <TableCell className="text-right">{b.ordenes}</TableCell>
                                        <TableCell className="text-right font-medium">{b.unidadesBase.toLocaleString('es-CO')}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* SKU sin cruce con inventario (para costos) */}
            {unlinkedSku.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" />SKU sin cruce con Inventario ({unlinkedSku.length})</CardTitle>
                        <CardDescription>
                            Estos items tienen SKU en el reporte pero no cruzaron con ningún producto del inventario
                            (SKU inexistente, o Dropi usó el ID como SKU). Vincúlalos al producto real para habilitar costo/margen.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {unlinkedSku.slice(0, 40).map(u => (
                                <Button key={u.itemId} variant="outline" size="sm" className="h-auto py-1.5" onClick={() => setMappingItem(u.itemId)}>
                                    <span className="flex flex-col items-start">
                                        <span className="flex items-center gap-2">
                                            <span className="font-mono text-xs">SKU {u.sku}</span>
                                            <Badge variant="outline" className="text-[10px]">{u.entregadas} entregadas</Badge>
                                        </span>
                                        {u.productName && <span className="text-[11px] text-muted-foreground max-w-[240px] truncate">{u.productName}</span>}
                                    </span>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Items sin mapear */}
            {unmapped.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" />Items por Revisar ({unmapped.length})</CardTitle>
                        <CardDescription>
                            Items con ventas que necesitan vinculación: sin mapeo, o con producto conocido pero sin dueño
                            (si es privado, indica el correo; si es público, márcalo como público y deja de aparecer aquí).
                            Después de vincular, re-sube el archivo para atribuir sus ventas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {unmapped.slice(0, 30).map(u => (
                                <Button key={u.itemId} variant="outline" size="sm" className="h-auto py-1.5" onClick={() => setMappingItem(u.itemId)}>
                                    <span className="flex flex-col items-start">
                                        <span className="flex items-center gap-2">
                                            <span className="font-mono text-xs">{u.itemId}</span>
                                            <Badge variant={u.motivo === 'sin_mapeo' ? 'destructive' : 'secondary'} className="text-[10px]">
                                                {u.motivo === 'sin_mapeo' ? 'sin mapeo' : 'sin cliente'}
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px]">{u.entregadas} entregadas</Badge>
                                        </span>
                                        {u.productName && <span className="text-[11px] text-muted-foreground max-w-[240px] truncate">{u.productName}{u.variantName ? ` · ${u.variantName}` : ''}</span>}
                                    </span>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {unmappedTiendas.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Tiendas sin Vincular ({unmappedTiendas.length})</CardTitle>
                        <CardDescription>
                            La tienda identifica quién vendió cuando un item lo comparten varios clientes.
                            Vincula cada tienda a su cliente una vez y las ventas compartidas quedan exactas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {unmappedTiendas.slice(0, 30).map(t => (
                                <Button key={t.tienda} variant="outline" size="sm" onClick={() => { setTiendaDialog(t.tienda); setTiendaEmail(''); }}>
                                    {t.tienda} <Badge variant="secondary" className="ml-2">{t.ventas}</Badge>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
            </>
            )}

            <Dialog open={!!tiendaDialog} onOpenChange={(open) => !open && setTiendaDialog(null)}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Vincular Tienda</DialogTitle>
                        <DialogDescription>"{tiendaDialog}" — ¿a qué cliente pertenece esta tienda?</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Label htmlFor="tienda-email">Correo del cliente (el del CRM)</Label>
                        <Input id="tienda-email" value={tiendaEmail} onChange={e => setTiendaEmail(e.target.value)} className="mt-1" placeholder="cliente@correo.com" />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                        <Button onClick={async () => {
                            if (!tiendaDialog || !tiendaEmail.trim()) return;
                            try {
                                await saveTiendaMapping(tiendaDialog, tiendaEmail);
                                toast({ title: 'Tienda vinculada', description: 'Re-importa el archivo para aplicar la atribución exacta.' });
                                setTiendaDialog(null);
                                loadData();
                            } catch {
                                toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' });
                            }
                        }}>Vincular</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ManualMappingDialog
                platform={platform}
                itemId={mappingItem}
                onClose={() => setMappingItem(null)}
                onSaved={() => { setMappingItem(null); loadData(); }}
            />
        </div>
    );
}

function ManualMappingDialog({ platform, itemId, onClose, onSaved }: {
    platform: string;
    itemId: string | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [productId, setProductId] = useState<string | undefined>();
    const [productName, setProductName] = useState('');
    const [pickedVariants, setPickedVariants] = useState<Array<{ id: string; name: string; sku: string }>>([]);
    const [variantId, setVariantId] = useState<string | undefined>();
    const [variantName, setVariantName] = useState<string | undefined>();
    const [variantSku, setVariantSku] = useState<string | undefined>();
    const [clientEmail, setClientEmail] = useState('');
    const [visibility, setVisibility] = useState<'privado' | 'publico'>('publico');
    const [assignedQty, setAssignedQty] = useState('');
    const [unitsPerOrder, setUnitsPerOrder] = useState('');

    const handleSave = async () => {
        if (!itemId) return;
        if (!productName.trim() && !clientEmail.trim()) {
            toast({ title: 'Error', description: 'Indica al menos el producto o el correo del cliente.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            await saveManualMapping(platform, itemId, {
                productId,
                productName: productName.trim() || undefined,
                variantId,
                variantName,
                sku: variantSku,
                clientEmail: clientEmail.trim().toLowerCase() || undefined,
                visibility: clientEmail.trim() ? 'privado' : visibility,
                assignedQty: assignedQty ? Number(assignedQty) : undefined,
                unitsPerOrder: unitsPerOrder && Number(unitsPerOrder) > 1 ? Number(unitsPerOrder) : undefined,
                needsComposition: false,
            });
            toast({ title: 'Item vinculado', description: `El item ${itemId} quedó mapeado. Re-importa el archivo para atribuir sus ventas.` });
            setProductId(undefined); setProductName(''); setClientEmail(''); setAssignedQty(''); setUnitsPerOrder('');
            setPickedVariants([]); setVariantId(undefined); setVariantName(undefined); setVariantSku(undefined);
            onSaved();
        } catch (error) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo guardar.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={!!itemId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Vincular Item {itemId}</DialogTitle>
                    <DialogDescription>Asocia este ID de plataforma a un producto del inventario y/o al cliente dueño (si es privado).</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <div>
                        <Label>Producto del inventario</Label>
                        <div className="mt-1">
                            <ProductSearchPicker onSelect={(p) => {
                                setProductId(p.id);
                                setProductName(p.name);
                                setVariantId(undefined); setVariantName(undefined); setVariantSku(undefined);
                                setPickedVariants(p.productType === 'variable' ? (p.variants || []).map(v => ({ id: v.id, name: v.name, sku: v.sku })) : []);
                            }} />
                        </div>
                        {productName && <p className="text-xs text-green-600 mt-1">✓ {productName}{variantName ? ` — ${variantName}` : ''}</p>}
                    </div>
                    {pickedVariants.length > 0 && (
                        <div>
                            <Label>¿A qué variante corresponde este item?</Label>
                            <Select onValueChange={(v) => {
                                if (v === 'todas') { setVariantId(undefined); setVariantName(undefined); setVariantSku(undefined); return; }
                                const variant = pickedVariants.find(x => x.id === v);
                                if (variant) { setVariantId(variant.id); setVariantName(variant.name); setVariantSku(variant.sku); }
                            }}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Elige la variante…" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">El producto completo (todas)</SelectItem>
                                    {pickedVariants.map(v => (
                                        <SelectItem key={v.id} value={v.id}>{v.name} — SKU {v.sku}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">Cada ID de plataforma suele corresponder a UNA variante específica.</p>
                        </div>
                    )}
                    <div>
                        <Label htmlFor="map-email">Correo del cliente (si el item es privado)</Label>
                        <Input id="map-email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="mt-1" placeholder="cliente@correo.com" />
                    </div>
                    {!clientEmail.trim() && (
                        <div>
                            <Label>Visibilidad del item</Label>
                            <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="publico">Público</SelectItem>
                                    <SelectItem value="privado">Privado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div>
                        <Label htmlFor="map-qty">Stock asignado (opcional)</Label>
                        <Input id="map-qty" type="number" min="0" value={assignedQty} onChange={e => setAssignedQty(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                        <Label htmlFor="map-factor">Unidades del producto por venta (combo)</Label>
                        <Input id="map-factor" type="number" min="1" value={unitsPerOrder} onChange={e => setUnitsPerOrder(e.target.value)} className="mt-1" placeholder="1 (normal) · 2 si es x2 · 3 si es x3" />
                        <p className="text-xs text-muted-foreground mt-1">Si el item es un combo (SKUx2, SKUx3), cada venta descuenta este número de unidades base del inventario.</p>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Guardando…' : 'Vincular'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


const MESES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function formatMonthLabel(m: string): string {
    const [y, mo] = m.split('-');
    return `${MESES_ES[Number(mo) - 1] || mo} ${y}`;
}

// Cuenta compacta de clasificación (activaciones / reactivaciones / públicas)
function ClasifDots({ v }: { v: { activaciones?: number; reactivaciones?: number; publicas?: number } }) {
    if (!v.activaciones && !v.reactivaciones && !v.publicas) return null;
    return (
        <span className="ml-1.5 text-[10px] text-muted-foreground whitespace-nowrap">
            {v.activaciones ? <span className="text-green-600">🟢{v.activaciones} </span> : null}
            {v.reactivaciones ? <span className="text-amber-600">🟠{v.reactivaciones} </span> : null}
            {v.publicas ? <span>⚪{v.publicas}</span> : null}
        </span>
    );
}

// Mini-tabla de un desglose (plataforma / comercial / país) dentro de la tarjeta de mes
function MiniBreakdown({ titulo, rows }: {
    titulo: string;
    rows: Array<{ label: string; ventas: number; total: number; clasif?: { activaciones?: number; reactivaciones?: number; publicas?: number } }>;
}) {
    return (
        <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{titulo}</h4>
            {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">—</p>
            ) : (
                <table className="w-full text-sm">
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.label} className="border-b border-border/40 last:border-0">
                                <td className="py-1 pr-2 align-top">
                                    <span className="font-medium">{r.label}</span>
                                    {r.clasif && <ClasifDots v={r.clasif} />}
                                </td>
                                <td className="py-1 text-right tabular-nums whitespace-nowrap align-top">{r.ventas}</td>
                                <td className="py-1 pl-3 text-right tabular-nums whitespace-nowrap text-muted-foreground align-top">${r.total.toLocaleString('es-CO')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

// Tarjeta de un mes: cabecera con el TOTAL y tres columnas de desglose
function MonthSummaryCard({ month, total, plataforma, comercial, pais }: {
    month: string;
    total?: { ventas: number; total: number; pendingOrders: number; closed: boolean };
    plataforma?: Map<string, { ventas: number; total: number }>;
    comercial?: Map<string, { ventas: number; total: number; activaciones: number; reactivaciones: number; publicas: number }>;
    pais?: Map<string, { ventas: number; total: number }>;
}) {
    const platRows = Array.from(plataforma?.entries() || [])
        .map(([label, v]) => ({ label, ventas: v.ventas, total: v.total }))
        .sort((a, b) => b.ventas - a.ventas);
    const comRows = Array.from(comercial?.entries() || [])
        .map(([label, v]) => ({ label, ventas: v.ventas, total: v.total, clasif: { activaciones: v.activaciones, reactivaciones: v.reactivaciones, publicas: v.publicas } }))
        .sort((a, b) => b.ventas - a.ventas);
    const paisRows = Array.from(pais?.entries() || [])
        .map(([label, v]) => ({ label, ventas: v.ventas, total: v.total }))
        .sort((a, b) => b.ventas - a.ventas);

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-lg capitalize">{formatMonthLabel(month)}</CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-sm px-2.5 py-1">{(total?.ventas ?? 0).toLocaleString('es-CO')} ventas</Badge>
                        <Badge variant="default" className="text-sm px-2.5 py-1">${(total?.total ?? 0).toLocaleString('es-CO')}</Badge>
                        {total && (total.closed
                            ? <Badge variant="outline">Cerrado</Badge>
                            : <Badge variant="destructive">{total.pendingOrders} pendientes</Badge>)}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                    <MiniBreakdown titulo="Por plataforma" rows={platRows} />
                    <MiniBreakdown titulo="Por comercial" rows={comRows} />
                    <MiniBreakdown titulo="Por país" rows={paisRows} />
                </div>
            </CardContent>
        </Card>
    );
}

function BreakdownCard({ titulo, data }: { titulo: string; data: Breakdown }) {
    const meses = Array.from(data.keys()).sort().reverse();
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{titulo}</CardTitle>
                <CardDescription>Ventas entregadas mes a mes</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Mes</TableHead>
                            <TableHead>Origen</TableHead>
                            <TableHead className="text-right">Ventas</TableHead>
                            <TableHead className="text-right">Total (COP)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {meses.flatMap(mes => {
                            const rows = Array.from(data.get(mes)!.entries()).sort((a, b) => b[1].ventas - a[1].ventas);
                            return rows.map(([origen, v], i) => (
                                <TableRow key={`${mes}_${origen}`}>
                                    <TableCell className="font-medium">{i === 0 ? mes : ''}</TableCell>
                                    <TableCell>{origen}</TableCell>
                                    <TableCell className="text-right">{v.ventas}</TableCell>
                                    <TableCell className="text-right">${v.total.toLocaleString('es-CO')}</TableCell>
                                </TableRow>
                            ));
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}


function UnificarComercialesCard({ comerciales, onSaved }: { comerciales: Array<{ raw: string; canonical: string; ventas: number }>; onSaved: () => void }) {
    const { toast } = useToast();
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // Nombres canónicos ya usados (para sugerir en el datalist)
    const canonicos = Array.from(new Set(comerciales.map(x => x.canonical))).sort();

    const handleSave = async () => {
        const cambios = Object.entries(edits).filter(([raw, val]) => val.trim() && val.trim() !== raw);
        if (cambios.length === 0) { toast({ title: 'Sin cambios' }); return; }
        setSaving(true);
        try {
            for (const [raw, canonical] of cambios) await saveCommercialAlias(raw, canonical.trim());
            toast({ title: 'Comerciales unificados', description: `${cambios.length} alias guardados. Los reportes ya agrupan por el nombre unificado.` });
            setEdits({});
            onSaved();
        } catch {
            toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Unificar Comerciales ({comerciales.length} nombres)</CardTitle>
                <CardDescription>
                    Escribe el nombre unificado para cada variante (ej: 'josemsuarez' y 'JOSE MANUEL SUAREZ' → el mismo).
                    Los reportes agruparán por el nombre unificado.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <datalist id="canonicos-comerciales">
                    {canonicos.map(c => <option key={c} value={c} />)}
                </datalist>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre en los datos</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead>Nombre unificado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {comerciales.map(c => (
                            <TableRow key={c.raw}>
                                <TableCell className="font-mono text-xs">{c.raw}</TableCell>
                                <TableCell className="text-right">{c.ventas}</TableCell>
                                <TableCell>
                                    <Input
                                        list="canonicos-comerciales"
                                        defaultValue={c.canonical}
                                        onChange={e => setEdits(prev => ({ ...prev, [c.raw]: e.target.value }))}
                                        className="h-8 max-w-[240px]"
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="mt-3">
                    <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar unificación'}</Button>
                </div>
            </CardContent>
        </Card>
    );
}


function ComercialAliasRow({ com, onSaved }: { com: { raw: string; canonical: string; ventas: number }; onSaved: () => void }) {
    const { toast } = useToast();
    const [value, setValue] = useState(com.canonical);
    const [saving, setSaving] = useState(false);
    const dirty = value.trim() && value.trim() !== com.canonical;
    const save = async () => {
        if (!dirty) return;
        setSaving(true);
        try {
            await saveCommercialAlias(com.raw, value.trim());
            toast({ title: 'Unificado', description: `"${com.raw}" → "${value.trim()}"` });
            onSaved();
        } catch {
            toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' });
        } finally { setSaving(false); }
    };
    return (
        <TableRow>
            <TableCell className="font-medium">{com.raw}</TableCell>
            <TableCell className="text-right">{com.ventas}</TableCell>
            <TableCell className="text-muted-foreground">{com.canonical}</TableCell>
            <TableCell>
                <div className="flex gap-1">
                    <Input list="canon-comerciales" value={value} onChange={e => setValue(e.target.value)} className="h-8 w-48" />
                    <Button size="sm" className="h-8" onClick={save} disabled={!dirty || saving}>{saving ? '…' : 'OK'}</Button>
                </div>
            </TableCell>
        </TableRow>
    );
}
