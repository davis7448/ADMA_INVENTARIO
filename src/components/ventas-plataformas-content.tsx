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
    getUnmappedTiendas, saveTiendaMapping, getSalesBreakdown, getBaseUnitConsumption,
    type ImportSummary, type ReportMonth,
} from '@/lib/platform-sales';
import { loadCrmConfig } from '@/lib/client-volume';
import { ProductSearchPicker } from '@/components/product-search-picker';
import { AlertTriangle, FileUp, Link2, Upload } from 'lucide-react';

const PLATFORMS = ['DROPI', 'VENNDELO'];
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
    const [tiendaDialog, setTiendaDialog] = useState<string | null>(null);
    const [tiendaEmail, setTiendaEmail] = useState('');

    const canImport = !!user && ['admin', 'coordinacion', 'commercial_director', 'plataformas'].includes(user.role);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [m, s, u, c, t, b, bu] = await Promise.all([
                getReportMonths(),
                getSalesByMonthAndCommercial(),
                getUnmappedItems(platform),
                getAssignmentConsumption(platform),
                getUnmappedTiendas(platform),
                getSalesBreakdown(),
                getBaseUnitConsumption(platform),
            ]);
            setMonths(m); setByMonthCommercial(s); setUnmapped(u); setConsumption(c); setUnmappedTiendas(t);
            setByBodega(b.byBodega); setByPais(b.byPais); setBaseUnits(bu);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [platform]);

    const handleImport = async () => {
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
            loadData();
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo importar.', variant: 'destructive' });
        } finally {
            setIsImporting(false);
            setProgressMsg('');
        }
    };

    const openMonths = months.filter(m => !m.closed);
    const sortedMonths = useMemo(() => Array.from(byMonthCommercial.keys()).sort().reverse(), [byMonthCommercial]);
    const sobreventas = consumption.filter(c => c.pct > 100);
    const porAgotarse = consumption.filter(c => c.pct >= 80 && c.pct <= 100);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Ventas de Plataformas</h1>
                <p className="text-muted-foreground">Importa los reportes de despachos; las ventas entregadas alimentan conversión, clasificación y volumen por cliente.</p>
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

            {/* Importar */}
            {canImport && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base"><FileUp className="h-4 w-4" />Importar Reporte de Despachos</CardTitle>
                        <CardDescription>Se deduplica por número de guía: puedes subir el mismo periodo varias veces y solo se actualizan los estados.</CardDescription>
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
                            <div>
                                <Label>País</Label>
                                <Select value={pais} onValueChange={setPais}>
                                    <SelectTrigger className="w-36 mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PAISES_VENTA.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 w-full">
                                <Label htmlFor="sales-file">Archivo (.xlsx)</Label>
                                <Input id="sales-file" type="file" accept=".xlsx,.xls" className="mt-1" onChange={e => setFile(e.target.files?.[0] || null)} />
                            </div>
                            <Button onClick={handleImport} disabled={isImporting || !file}>
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
                                <Badge variant="outline">{summary.mapeosCreados} mapeos creados</Badge>
                                <Badge variant="default">{summary.ofertasConvertidas} ofertas → pedido</Badge>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Ventas × mes × comercial */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Ventas Entregadas × Mes × Comercial</CardTitle>
                    <CardDescription>Con clasificación: activaciones, reactivaciones y ventas públicas.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {isLoading ? <Skeleton className="h-32 w-full" /> : sortedMonths.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Mes</TableHead>
                                    <TableHead>Comercial</TableHead>
                                    <TableHead className="text-right">Ventas</TableHead>
                                    <TableHead className="text-right">Total (COP)</TableHead>
                                    <TableHead className="text-right">🟢 Activ.</TableHead>
                                    <TableHead className="text-right">🟠 React.</TableHead>
                                    <TableHead className="text-right">⚪ Públicas</TableHead>
                                    <TableHead>Cierre</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedMonths.flatMap(month => {
                                    const monthInfo = months.find(m => m.month === month);
                                    const rows = Array.from(byMonthCommercial.get(month)!.entries()).sort((a, b) => b[1].ventas - a[1].ventas);
                                    return rows.map(([commercial, v], i) => (
                                        <TableRow key={`${month}_${commercial}`}>
                                            <TableCell className="font-medium">{i === 0 ? month : ''}</TableCell>
                                            <TableCell>{commercial}</TableCell>
                                            <TableCell className="text-right">{v.ventas}</TableCell>
                                            <TableCell className="text-right">${v.total.toLocaleString('es-CO')}</TableCell>
                                            <TableCell className="text-right">{v.activaciones || '—'}</TableCell>
                                            <TableCell className="text-right">{v.reactivaciones || '—'}</TableCell>
                                            <TableCell className="text-right">{v.publicas || '—'}</TableCell>
                                            <TableCell>
                                                {i === 0 && monthInfo && (
                                                    <Badge variant={monthInfo.closed ? 'outline' : 'destructive'}>
                                                        {monthInfo.closed ? 'Cerrado' : `${monthInfo.pendingOrders} pendientes`}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ));
                                })}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-6">Aún no hay ventas importadas. Sube el primer reporte.</p>
                    )}
                </CardContent>
            </Card>

            {/* Desglose por bodega y país */}
            {(byBodega.size > 0 || byPais.size > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <BreakdownCard titulo="Ventas por Bodega" data={byBodega} />
                    <BreakdownCard titulo="Ventas por País" data={byPais} />
                </div>
            )}

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
