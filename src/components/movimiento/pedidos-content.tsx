"use client";

// Pedidos despachados por día, semana y mes, de cada país y desglosados por bodega.
//
// Lee la colección pre-agregada vía getPedidosPorPais(). Ver la advertencia sobre qué
// significa "salidos" en src/app/actions/pedidos-por-pais.ts: se cuenta por fecha de
// CREACIÓN del pedido, porque Dropi no entrega fecha de despacho.
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { getPedidosPorPais, type PedidosPorPais, type CuboPedidos } from '@/app/actions/pedidos-por-pais';
import type { Granularidad } from '@/lib/periodos';
import { etiquetaPais } from '@/lib/paises';
import { Download, Info, TriangleAlert } from 'lucide-react';

const VISTAS: { v: Granularidad; l: string }[] = [
    { v: 'dia', l: 'Por día' },
    { v: 'semana', l: 'Por semana' },
    { v: 'mes', l: 'Por mes' },
];

// Rango sugerido por vista: mirar 12 meses en columnas de un día no se lee, y una sola
// semana en columnas de mes no dice nada.
const RANGOS: Record<Granularidad, { v: string; l: string }[]> = {
    dia: [{ v: '14', l: 'Últimos 14 días' }, { v: '30', l: 'Últimos 30 días' }, { v: '60', l: 'Últimos 60 días' }],
    semana: [{ v: '56', l: 'Últimas 8 semanas' }, { v: '84', l: 'Últimas 12 semanas' }, { v: '182', l: 'Últimas 26 semanas' }],
    mes: [{ v: '90', l: 'Últimos 3 meses' }, { v: '180', l: 'Últimos 6 meses' }, { v: '365', l: 'Últimos 12 meses' }],
};
const RANGO_POR_DEFECTO: Record<Granularidad, string> = { dia: '30', semana: '84', mes: '365' };

// No se ofrece "Unidades": solo el 30% de los pedidos de Dropi trae `quantity` (el CSV de
// list_orders no incluye cantidad; solo la traen los enriquecidos con get_order). Mostrarla
// como métrica daría un número que parece el total y en realidad mide un tercio de los
// datos. El agregado sí la guarda, por si en el futuro el enriquecimiento la cubre entera.
const METRICAS = [
    { v: 'salidos', l: 'Despachados' },
    { v: 'creados', l: 'Creados' },
    { v: 'entregados', l: 'Entregados' },
] as const;
type Metrica = (typeof METRICAS)[number]['v'];

// La paleta del tema (--chart-1..5) es casi toda amarilla, así que varias series de países
// quedarían indistinguibles. Se usan tonos separados en el círculo cromático y, además,
// un trazo distinto por serie: el color no puede ser el único indicador.
const COLORES = ['hsl(56 83% 45%)', 'hsl(197 60% 40%)', 'hsl(27 87% 55%)', 'hsl(150 45% 38%)', 'hsl(280 45% 55%)', 'hsl(0 65% 55%)'];
const TRAZOS = ['0', '6 3', '2 2', '10 4', '4 2 1 2', '8 2 2 2'];

const num = (n: number) => n.toLocaleString('es-CO');

export function PedidosContent() {
    const { toast } = useToast();
    const [datos, setDatos] = useState<PedidosPorPais | null>(null);
    const [cargando, setCargando] = useState(true);
    const [vista, setVista] = useState<Granularidad>('dia');
    const [rango, setRango] = useState(RANGO_POR_DEFECTO.dia);
    const [pais, setPais] = useState('todos');
    const [bodega, setBodega] = useState('todas');
    const [metrica, setMetrica] = useState<Metrica>('salidos');

    // Al cambiar de vista, el rango anterior puede no existir en la nueva lista.
    const cambiarVista = (v: Granularidad) => { setVista(v); setRango(RANGO_POR_DEFECTO[v]); };

    useEffect(() => {
        let vigente = true;
        setCargando(true);
        getPedidosPorPais({ dias: Number(rango), granularidad: vista, pais, bodega })
            .then(d => { if (vigente) setDatos(d); })
            .catch(() => toast({ title: 'Error', description: 'No se pudieron cargar los pedidos.', variant: 'destructive' }))
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [rango, vista, pais, bodega, toast]);

    const etiquetaMetrica = METRICAS.find(m => m.v === metrica)?.l ?? '';

    // Serie temporal: una fila por periodo, una columna por país.
    const serie = useMemo(() => {
        if (!datos) return [];
        return datos.periodos.map(p => {
            const fila: Record<string, string | number> = { periodo: p.etiqueta };
            for (const pa of datos.paises) fila[pa] = datos.porPeriodoPais[p.clave]?.[pa]?.[metrica] ?? 0;
            return fila;
        });
    }, [datos, metrica]);

    const serieBodegas = useMemo(() => {
        if (!datos) return [];
        return datos.bodegas.map(b => ({ bodega: b, valor: datos.totalPorBodega[b][metrica] }));
    }, [datos, metrica]);

    const configGrafica = useMemo<ChartConfig>(() => {
        const c: ChartConfig = {};
        (datos?.paises || []).forEach((p, i) => { c[p] = { label: etiquetaPais(p), color: COLORES[i % COLORES.length] }; });
        return c;
    }, [datos]);

    const descargar = () => {
        if (!datos) return;
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
            datos.periodos.map(p => ({
                Periodo: p.etiqueta,
                ...Object.fromEntries(datos.paises.map(pa => [pa, datos.porPeriodoPais[p.clave]?.[pa]?.[metrica] ?? 0])),
                Total: datos.totalPorPeriodo[p.clave]?.[metrica] ?? 0,
            }))
        ), `${etiquetaMetrica} por periodo`);

        const filasDetalle: Record<string, string | number>[] = [];
        for (const pa of datos.paises) {
            for (const [bo, c] of Object.entries(datos.porPaisBodega[pa] || {})) {
                filasDetalle.push({
                    País: pa, Bodega: bo, Despachados: c.salidos, Creados: c.creados,
                    Entregados: c.entregados, Ingreso: Math.round(c.ingreso),
                    // Dropi solo entrega cantidad en ~30% de los pedidos; se marca para que
                    // nadie sume esta columna creyendo que es el total.
                    'Unidades (dato parcial)': c.unidades,
                });
            }
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filasDetalle), 'País y bodega');
        XLSX.writeFile(wb, `pedidos-por-pais_${vista}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    if (cargando || !datos) {
        return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" /></div>;
    }

    if (datos.sinAgregado) {
        return (
            <Alert variant="destructive">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>El agregado diario no se ha generado</AlertTitle>
                <AlertDescription>
                    Esta vista lee la colección <code>dailyOrders</code>, que construye el cron
                    <code className="mx-1">scripts/agregar-pedidos-diarios.ts</code>. No hay ningún día
                    calculado todavía; hasta que corra, no hay nada que mostrar.
                </AlertDescription>
            </Alert>
        );
    }

    const sinDatos = datos.periodos.length === 0;
    const porcentajeSalido = datos.total.creados ? Math.round((datos.total.salidos / datos.total.creados) * 100) : 0;

    return (
        <div className="space-y-4">
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Los pedidos se cuentan por su fecha de creación</AlertTitle>
                <AlertDescription>
                    Dropi no entrega la fecha de despacho, así que «despachados» son los pedidos
                    <strong> creados</strong> ese día que a día de hoy ya salieron de bodega. En los días
                    más recientes la cifra se queda corta, porque parte de esos pedidos todavía no ha salido.
                    Esta vista cuenta <strong>solo pedidos de Dropi</strong>: las ventas de HOKO, EFFI y
                    Venndelo —incluidas las bodegas de fulfillment— no aparecen aquí.
                </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-3">
                <Filtro label="Vista" value={vista} onChange={v => cambiarVista(v as Granularidad)}
                    opciones={VISTAS.map(v => ({ v: v.v, l: v.l }))} ancho="w-36" />
                <Filtro label="Periodo" value={rango} onChange={setRango} opciones={RANGOS[vista]} ancho="w-48" />
                <Filtro label="Métrica" value={metrica} onChange={v => setMetrica(v as Metrica)}
                    opciones={METRICAS.map(m => ({ v: m.v, l: m.l }))} ancho="w-40" />
                <Filtro label="País" value={pais} onChange={setPais} ancho="w-52"
                    opciones={[{ v: 'todos', l: 'Todos' }, ...datos.paisesDisponibles.map(p => ({ v: p, l: etiquetaPais(p) }))]} />
                <Filtro label="Bodega" value={bodega} onChange={setBodega} ancho="w-56"
                    opciones={[{ v: 'todas', l: 'Todas' }, ...datos.bodegasDisponibles.map(b => ({ v: b, l: b }))]} />
                <div className="flex items-end">
                    <Button onClick={descargar} disabled={sinDatos} className="cursor-pointer">
                        <Download className="mr-2 h-4 w-4" /> Descargar Excel
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi l="Despachados" v={num(datos.total.salidos)} />
                <Kpi l="Creados" v={num(datos.total.creados)} />
                <Kpi l="Ya salieron" v={`${porcentajeSalido}%`} nota={`${num(datos.total.creados - datos.total.salidos)} aún en bodega o anulados`} />
                <Kpi l="Entregados" v={num(datos.total.entregados)} />
            </div>

            {sinDatos ? (
                <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Sin movimiento en el periodo seleccionado.
                </CardContent></Card>
            ) : (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>{etiquetaMetrica} por {vista === 'dia' ? 'día' : vista}</CardTitle>
                            <CardDescription>
                                Una línea por país · {datos.periodos.length} periodo(s) · datos hasta el {datos.ultimoDia}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={configGrafica} className="aspect-auto h-[320px] w-full">
                                <ResponsiveContainer>
                                    <LineChart data={serie} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                        <XAxis dataKey="periodo" fontSize={12} tickLine={false} axisLine={false} tickMargin={8}
                                            interval="preserveStartEnd" minTickGap={24} />
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} width={56} />
                                        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                                        <Legend />
                                        {datos.paises.map((p, i) => (
                                            <Line key={p} type="monotone" dataKey={p} name={etiquetaPais(p)}
                                                stroke={COLORES[i % COLORES.length]} strokeWidth={2}
                                                strokeDasharray={TRAZOS[i % TRAZOS.length]}
                                                dot={false} activeDot={{ r: 4 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </CardContent>
                    </Card>

                    <div className="grid lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">{etiquetaMetrica} por bodega</CardTitle>
                                <CardDescription>Total del periodo</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ChartContainer config={{ valor: { label: etiquetaMetrica, color: 'hsl(var(--primary))' } }} className="aspect-auto h-[280px] w-full">
                                    <ResponsiveContainer>
                                        <BarChart data={serieBodegas} layout="vertical" margin={{ left: 8, right: 16 }}>
                                            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                            <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                            <YAxis type="category" dataKey="bodega" width={140} fontSize={11} tickLine={false} axisLine={false} />
                                            <ChartTooltip content={<ChartTooltipContent />} />
                                            <Bar dataKey="valor" name={etiquetaMetrica} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Detalle por país y bodega</CardTitle>
                                <CardDescription>Mismos números de la gráfica, en cifras exactas</CardDescription>
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>País / Bodega</TableHead>
                                            <TableHead className="text-right">Despachados</TableHead>
                                            <TableHead className="text-right">Creados</TableHead>
                                            <TableHead className="text-right">Entregados</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {datos.paises.map(pa => (
                                            <FilasPais key={pa} pais={pa} bodegas={datos.porPaisBodega[pa] || {}} total={datos.totalPorPais[pa]} />
                                        ))}
                                        <TableRow className="border-t-2">
                                            <TableCell className="font-bold">Total</TableCell>
                                            <TableCell className="text-right font-bold">{num(datos.total.salidos)}</TableCell>
                                            <TableCell className="text-right font-bold">{num(datos.total.creados)}</TableCell>
                                            <TableCell className="text-right font-bold">{num(datos.total.entregados)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}

function FilasPais({ pais, bodegas, total }: { pais: string; bodegas: Record<string, CuboPedidos>; total: CuboPedidos }) {
    const filas = Object.entries(bodegas).sort((a, b) => b[1].salidos - a[1].salidos);
    return (
        <>
            <TableRow className="bg-muted/50">
                <TableCell className="font-semibold">{etiquetaPais(pais)}</TableCell>
                <TableCell className="text-right font-semibold">{num(total.salidos)}</TableCell>
                <TableCell className="text-right font-semibold">{num(total.creados)}</TableCell>
                <TableCell className="text-right font-semibold">{num(total.entregados)}</TableCell>
            </TableRow>
            {filas.map(([b, c]) => (
                <TableRow key={b}>
                    <TableCell className="pl-6 text-muted-foreground whitespace-nowrap">{b}</TableCell>
                    <TableCell className="text-right">{num(c.salidos)}</TableCell>
                    <TableCell className="text-right">{num(c.creados)}</TableCell>
                    <TableCell className="text-right">{num(c.entregados)}</TableCell>
                </TableRow>
            ))}
        </>
    );
}

function Filtro({ label, value, onChange, opciones, ancho }: {
    label: string; value: string; onChange: (v: string) => void; opciones: { v: string; l: string }[]; ancho: string;
}) {
    return (
        <div className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className={`${ancho} cursor-pointer`}><SelectValue /></SelectTrigger>
                <SelectContent>{opciones.map(o => <SelectItem key={o.v} value={o.v} className="cursor-pointer">{o.l}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );
}

function Kpi({ l, v, nota }: { l: string; v: string; nota?: string }) {
    return (
        <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="text-2xl font-bold">{v}</p>
            {nota && <p className="text-xs text-muted-foreground mt-0.5">{nota}</p>}
        </div>
    );
}
