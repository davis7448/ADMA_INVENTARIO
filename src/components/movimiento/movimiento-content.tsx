"use client";

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getMovimientoDiario, type MovimientoDiario, type CeldaMovimiento } from '@/app/actions/movimiento-diario';
import { etiquetaPais, formatearImporte, type Importes } from '@/lib/paises';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PedidosContent } from './pedidos-content';
import { Download } from 'lucide-react';

// Dos lecturas del mismo movimiento diario: quién lo genera (comercial) y por dónde sale
// (país y bodega). Comparten página para no repartir el mismo dato en dos sitios.
export function MovimientoContent() {
    return (
        <div className="p-4 md:p-6 space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Movimiento diario</h1>
                <p className="text-sm text-muted-foreground">Qué se mueve cada día, por comercial y por bodega.</p>
            </div>
            <Tabs defaultValue="comerciales" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="comerciales" className="cursor-pointer">Por comercial</TabsTrigger>
                    <TabsTrigger value="pedidos" className="cursor-pointer">Por país y bodega</TabsTrigger>
                </TabsList>
                <TabsContent value="comerciales" className="mt-0"><VistaComerciales /></TabsContent>
                <TabsContent value="pedidos" className="mt-0"><PedidosContent /></TabsContent>
            </Tabs>
        </div>
    );
}

const RANGOS = [
    { v: '7', l: 'Últimos 7 días' },
    { v: '14', l: 'Últimos 14 días' },
    { v: '30', l: 'Últimos 30 días' },
    { v: '90', l: 'Últimos 90 días' },
];

// Qué se cuenta en cada celda. "Ventas" son órdenes; "entregadas" son las que
// efectivamente llegaron, que es lo que se factura.
//
// El ingreso NO es una métrica sola: cada país factura en su moneda, así que se
// ofrece una métrica por divisa presente ("Ingreso COP", "Ingreso USD"). Sumarlas
// en una sola columna daría un número sin significado.
const METRICAS_BASE = [
    { v: 'ventas', l: 'Órdenes' },
    { v: 'entregadas', l: 'Entregadas' },
    { v: 'unidades', l: 'Unidades' },
] as const;
type Metrica = string; // 'ventas' | 'entregadas' | 'unidades' | `ingreso:${moneda}`

const monedaDeMetrica = (m: Metrica) => m.startsWith('ingreso:') ? m.slice(8) : null;

// Monedas presentes en el periodo, de mayor a menor volumen.
const monedasDe = (i?: Importes) =>
    Object.entries(i || {}).sort((a, b) => b[1] - a[1]).map(([m]) => m);

const dia = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
const num = (n: number, m: Metrica) => {
    const moneda = monedaDeMetrica(m);
    return moneda ? formatearImporte(Math.round(n), moneda) : n.toLocaleString('es-CO');
};

// Valor de una celda para la métrica activa.
const celda = (c: CeldaMovimiento | undefined, m: Metrica): number => {
    if (!c) return 0;
    const moneda = monedaDeMetrica(m);
    if (moneda) return c.ingresos?.[moneda] || 0;
    return (c as any)[m] || 0;
};

function VistaComerciales() {
    const { toast } = useToast();
    const [datos, setDatos] = useState<MovimientoDiario | null>(null);
    const [cargando, setCargando] = useState(true);
    const [rango, setRango] = useState('30');
    const [pais, setPais] = useState('todos');
    const [plataforma, setPlataforma] = useState('todas');
    const [metrica, setMetrica] = useState<Metrica>('ventas');

    useEffect(() => {
        let vigente = true;
        setCargando(true);
        getMovimientoDiario({ dias: Number(rango), pais, plataforma })
            .then(d => { if (vigente) setDatos(d); })
            .catch(() => toast({ title: 'Error', description: 'No se pudo cargar el movimiento.', variant: 'destructive' }))
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [rango, pais, plataforma, toast]);

    const valor = (c?: CeldaMovimiento) => celda(c, metrica);

    // Las divisas dependen de los datos cargados, así que la lista de métricas se
    // arma después de la consulta. Si la métrica activa era de una moneda que ya no
    // está en el periodo filtrado, se vuelve a "Órdenes".
    const monedas = useMemo(() => monedasDe(datos?.total.ingresos), [datos]);
    const metricas = useMemo(() => [
        ...METRICAS_BASE.map(m => ({ v: m.v as Metrica, l: m.l })),
        ...monedas.map(mo => ({ v: `ingreso:${mo}`, l: `Ingreso ${mo}` })),
    ], [monedas]);
    useEffect(() => {
        const moneda = monedaDeMetrica(metrica);
        if (moneda && datos && !monedas.includes(moneda)) setMetrica('ventas');
    }, [monedas, metrica, datos]);

    // Los días se muestran del más reciente al más antiguo: lo de hoy es lo que se mira.
    const diasVista = useMemo(() => (datos?.dias || []).slice().reverse(), [datos]);

    const descargar = () => {
        if (!datos) return;
        const filas = datos.comerciales.map(c => ({
            Comercial: c,
            ...Object.fromEntries(diasVista.map(d => [dia(d), valor(datos.porComercialDia[c]?.[d])])),
            Total: valor(datos.totalPorComercial[c]),
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), 'Por comercial');
        // Una columna de ingreso POR MONEDA, nunca una sola sumando todo.
        const ingresoCols = (c: CeldaMovimiento) =>
            Object.fromEntries(monedas.map(mo => [`Ingreso ${mo}`, c.ingresos?.[mo] || 0]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            Object.entries(datos.porPais).map(([p, c]) => ({ País: p, Órdenes: c.ventas, Entregadas: c.entregadas, Unidades: c.unidades, ...ingresoCols(c) }))
        ), 'Por país');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            Object.entries(datos.porPlataforma).map(([p, c]) => ({ Plataforma: p, Órdenes: c.ventas, Entregadas: c.entregadas, Unidades: c.unidades, ...ingresoCols(c) }))
        ), 'Por plataforma');
        XLSX.writeFile(wb, `movimiento-diario_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    if (cargando || !datos) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-72 w-full" /></div>;

    const sinDatos = datos.dias.length === 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
                <Filtro label="Periodo" value={rango} onChange={setRango} opciones={RANGOS.map(r => ({ v: r.v, l: r.l }))} ancho="w-44" />
                <Filtro label="Métrica" value={metrica} onChange={v => setMetrica(v as Metrica)} opciones={metricas} ancho="w-44" />
                <Filtro label="País" value={pais} onChange={setPais} ancho="w-48"
                    opciones={[{ v: 'todos', l: 'Todos' }, ...datos.paisesDisponibles.map(p => ({ v: p, l: etiquetaPais(p) }))]} />
                <Filtro label="Plataforma" value={plataforma} onChange={setPlataforma} ancho="w-44"
                    opciones={[{ v: 'todas', l: 'Todas' }, ...datos.plataformasDisponibles.map(p => ({ v: p, l: p }))]} />
                <div className="flex items-end">
                    <Button onClick={descargar} disabled={sinDatos} className="cursor-pointer">
                        <Download className="mr-2 h-4 w-4" /> Descargar Excel
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi l="Órdenes" v={datos.total.ventas.toLocaleString('es-CO')} />
                <Kpi l="Entregadas" v={datos.total.entregadas.toLocaleString('es-CO')} />
                <Kpi l="Unidades" v={datos.total.unidades.toLocaleString('es-CO')} />
                {monedas.length === 0
                    ? <Kpi l="Ingreso" v="0" />
                    : monedas.map(mo => (
                        <Kpi key={mo} l={`Ingreso ${mo}`} v={formatearImporte(Math.round(datos.total.ingresos[mo] || 0), mo)} />
                    ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Por comercial y día</CardTitle>
                    <CardDescription>
                        {metricas.find(m => m.v === metrica)?.l} · {datos.comerciales.length} comercial(es) · {datos.dias.length} día(s)
                    </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {sinDatos ? <p className="text-sm text-muted-foreground py-6 text-center">Sin movimiento en el periodo.</p> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 bg-background">Comercial</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    {diasVista.map(d => <TableHead key={d} className="text-right whitespace-nowrap">{dia(d)}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {datos.comerciales.map(c => (
                                    <TableRow key={c}>
                                        <TableCell className="font-medium sticky left-0 bg-background whitespace-nowrap">{c}</TableCell>
                                        <TableCell className="text-right font-bold">{num(valor(datos.totalPorComercial[c]), metrica)}</TableCell>
                                        {diasVista.map(d => {
                                            const v = valor(datos.porComercialDia[c]?.[d]);
                                            return <TableCell key={d} className="text-right">{v ? num(v, metrica) : <span className="text-muted-foreground">—</span>}</TableCell>;
                                        })}
                                    </TableRow>
                                ))}
                                <TableRow className="border-t-2">
                                    <TableCell className="font-bold sticky left-0 bg-background">Total del día</TableCell>
                                    <TableCell className="text-right font-bold">{num(valor(datos.total), metrica)}</TableCell>
                                    {diasVista.map(d => (
                                        <TableCell key={d} className="text-right font-bold">{num(valor(datos.totalPorDia[d]), metrica)}</TableCell>
                                    ))}
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
                <Resumen titulo="Por país" datos={datos.porPais} metrica={metrica} etiqueta={etiquetaPais} />
                <Resumen titulo="Por plataforma" datos={datos.porPlataforma} metrica={metrica} />
            </div>
        </div>
    );
}

function Filtro({ label, value, onChange, opciones, ancho }: {
    label: string; value: string; onChange: (v: string) => void; opciones: { v: string; l: string }[]; ancho: string;
}) {
    return (
        <div className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className={ancho}><SelectValue /></SelectTrigger>
                <SelectContent>{opciones.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );
}

function Kpi({ l, v }: { l: string; v: string }) {
    return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></div>;
}

function Resumen({ titulo, datos, metrica, etiqueta }: {
    titulo: string; datos: Record<string, CeldaMovimiento>; metrica: Metrica; etiqueta?: (s: string) => string;
}) {
    const filas = Object.entries(datos).sort((a, b) => celda(b[1], metrica) - celda(a[1], metrica));
    return (
        <Card>
            <CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableBody>
                        {filas.map(([k, c]) => (
                            <TableRow key={k}>
                                <TableCell>{etiqueta ? etiqueta(k) : k}</TableCell>
                                <TableCell className="text-right font-medium">{num(celda(c, metrica), metrica)}</TableCell>
                            </TableRow>
                        ))}
                        {!filas.length && <TableRow><TableCell className="text-muted-foreground text-sm">Sin datos.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
