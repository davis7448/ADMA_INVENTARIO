"use client";

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { getAllClients } from '@/lib/commercial-api';
import {
    getActividadComercial, resumenPorComercial, semanaPorDia, clientesPorEstado,
    inicioDeSemana, finDeSemana, DIAS_SEMANA, TIPO_ETIQUETA, ESTADO_ETIQUETA, ESTADOS_KANBAN,
    type RegistroActividad, type ActividadTipo,
} from '@/lib/actividad-comercial';
import type { CommercialClient } from '@/types/commercial';
import { AlertCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react';

const TIPOS: ActividadTipo[] = ['alta', 'nota', 'oferta', 'testeo', 'pedido', 'cambio_estado', 'edicion'];

const RANGOS = [
    { value: '7', label: 'Últimos 7 días' },
    { value: '30', label: 'Últimos 30 días' },
    { value: '90', label: 'Últimos 90 días' },
    { value: '365', label: 'Último año' },
    { value: 'all', label: 'Todo el histórico' },
];

const fmtFecha = (d: Date | null) => d ? d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtFechaHora = (d: Date | null) => d ? d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDiaCorto = (d: Date) => d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

export function ActividadContent() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [registros, setRegistros] = useState<RegistroActividad[]>([]);
    const [clientes, setClientes] = useState<CommercialClient[]>([]);
    const [cargando, setCargando] = useState(true);
    const [rango, setRango] = useState('30');
    const [comercialFiltro, setComercialFiltro] = useState('todos');
    const [tipoFiltro, setTipoFiltro] = useState('todos');
    const [lunes, setLunes] = useState(() => inicioDeSemana(new Date()));

    // Un comercial solo ve lo suyo; la dirección ve a todos.
    const esDireccion = user?.role === 'admin' || user?.role === 'commercial_director';
    const comercialFijo = !esDireccion ? user?.id : undefined;

    const { desde, hasta } = useMemo(() => {
        const fin = new Date();
        fin.setHours(23, 59, 59, 999);
        if (rango === 'all') return { desde: new Date(2000, 0, 1), hasta: fin };
        const ini = new Date();
        ini.setDate(ini.getDate() - Number(rango));
        ini.setHours(0, 0, 0, 0);
        return { desde: ini, hasta: fin };
    }, [rango]);

    useEffect(() => {
        if (!user) return;
        let vigente = true;
        setCargando(true);
        Promise.all([
            getActividadComercial({ desde, hasta, comercialId: comercialFijo }),
            getAllClients(),
        ])
            .then(([acts, cls]) => {
                if (!vigente) return;
                setRegistros(acts);
                setClientes(comercialFijo ? cls.filter(c => c.assigned_commercial_id === comercialFijo) : cls);
            })
            .catch(error => {
                console.error(error);
                toast({ title: 'Error', description: 'No se pudo cargar la actividad.', variant: 'destructive' });
            })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [user, desde, hasta, comercialFijo, toast]);

    const comerciales = useMemo(
        () => [...new Set(registros.map(r => r.comercialNombre))].sort(),
        [registros],
    );

    const filtrados = useMemo(() => registros.filter(r =>
        (comercialFiltro === 'todos' || r.comercialNombre === comercialFiltro)
        && (tipoFiltro === 'todos' || r.tipo === tipoFiltro)
    ), [registros, comercialFiltro, tipoFiltro]);

    const conFecha = useMemo(() => filtrados.filter(r => r.fecha), [filtrados]);
    const sinFecha = useMemo(() => filtrados.filter(r => !r.fecha), [filtrados]);
    const resumen = useMemo(() => resumenPorComercial(filtrados), [filtrados]);
    const semana = useMemo(() => semanaPorDia(filtrados, lunes), [filtrados, lunes]);
    const kanban = useMemo(() => clientesPorEstado(clientes), [clientes]);
    const inferidos = useMemo(() => filtrados.filter(r => r.atribucion === 'inferida').length, [filtrados]);

    const moverSemana = (dias: number) => {
        const d = new Date(lunes);
        d.setDate(d.getDate() + dias);
        setLunes(inicioDeSemana(d));
    };

    const descargar = () => {
        try {
            const wb = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen.map(f => ({
                Comercial: f.comercialNombre,
                ...Object.fromEntries(TIPOS.map(t => [TIPO_ETIQUETA[t], f.porTipo[t]])),
                Total: f.total,
                'Atribución inferida': f.inferidos,
            }))), 'Resumen');

            const domingo = finDeSemana(lunes);
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(semana.map(f => ({
                Comercial: f.comercialNombre,
                ...Object.fromEntries(DIAS_SEMANA.map((d, i) => [d, f.porDia[i]])),
                Total: f.total,
            }))), `Semana ${fmtFecha(lunes)}-${fmtFecha(domingo)}`.slice(0, 31));

            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtrados.map(r => ({
                Fecha: r.fecha ? fmtFechaHora(r.fecha) : 'SIN FECHA REGISTRADA',
                Comercial: r.comercialNombre,
                Actividad: TIPO_ETIQUETA[r.tipo],
                Cliente: r.clienteNombre,
                'Estado kanban': ESTADO_ETIQUETA[r.estadoKanban] || r.estadoKanban,
                Detalle: r.detalle,
                Atribución: r.atribucion === 'confirmada' ? 'Confirmada' : 'Inferida (sin autor registrado)',
            }))), 'Detalle');

            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kanban.map(f => ({
                Comercial: f.comercialNombre,
                ...Object.fromEntries(ESTADOS_KANBAN.map(e => [ESTADO_ETIQUETA[e], f.porEstado[e]])),
                'Total clientes': f.total,
            }))), 'Kanban');

            XLSX.writeFile(wb, `actividad-comercial_${desde.toISOString().slice(0, 10)}_${hasta.toISOString().slice(0, 10)}.xlsx`);
            toast({ title: '¡Descargado!', description: `${filtrados.length} registros exportados en 4 hojas.` });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudo generar el Excel.', variant: 'destructive' });
        }
    };

    if (cargando) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Actividad comercial</h1>
                    <p className="text-sm text-muted-foreground">
                        {esDireccion
                            ? 'Gestión registrada por cada comercial, para revisar y auditar.'
                            : 'Tu actividad registrada en el CRM.'}
                    </p>
                </div>
                <Button onClick={descargar} disabled={!filtrados.length}>
                    <Download className="mr-2 h-4 w-4" /> Descargar Excel
                </Button>
            </div>

            <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">Periodo</Label>
                    <Select value={rango} onValueChange={setRango}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {RANGOS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {esDireccion && (
                    <div className="space-y-1">
                        <Label className="text-xs">Comercial</Label>
                        <Select value={comercialFiltro} onValueChange={setComercialFiltro}>
                            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                {comerciales.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="space-y-1">
                    <Label className="text-xs">Tipo de actividad</Label>
                    <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas</SelectItem>
                            {TIPOS.map(t => <SelectItem key={t} value={t}>{TIPO_ETIQUETA[t]}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* La app no registraba autoría ni eventos hasta hace poco. Decirlo evita que
                un reporte vacío se lea como "este comercial no trabajó". */}
            {inferidos > 0 && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Cómo leer este reporte</AlertTitle>
                    <AlertDescription className="text-sm">
                        {inferidos} de {filtrados.length} registros no guardaron quién los hizo: se le imputan al
                        comercial dueño del cliente y aparecen marcados como <strong>inferida</strong>. El registro
                        de autoría se corrigió recientemente, así que la actividad anterior está incompleta —
                        un total bajo en meses viejos refleja lo que la app registraba, no lo que se trabajó.
                    </AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="resumen">
                <TabsList>
                    <TabsTrigger value="resumen">Resumen</TabsTrigger>
                    <TabsTrigger value="semanal">Semanal</TabsTrigger>
                    <TabsTrigger value="detalle">Detalle ({filtrados.length})</TabsTrigger>
                    <TabsTrigger value="kanban">Kanban</TabsTrigger>
                </TabsList>

                <TabsContent value="resumen">
                    <Card>
                        <CardHeader>
                            <CardTitle>Actividad por comercial</CardTitle>
                            <CardDescription>
                                {conFecha.length} acciones con fecha en el periodo
                                {sinFecha.length > 0 && ` · ${sinFecha.length} sin fecha registrada`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Comercial</TableHead>
                                        {TIPOS.map(t => <TableHead key={t} className="text-right">{TIPO_ETIQUETA[t]}</TableHead>)}
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Inferidos</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {resumen.map(f => (
                                        <TableRow key={f.comercialNombre}>
                                            <TableCell className="font-medium">{f.comercialNombre}</TableCell>
                                            {TIPOS.map(t => (
                                                <TableCell key={t} className="text-right">
                                                    {f.porTipo[t] || <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right font-bold">{f.total}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{f.inferidos}</TableCell>
                                        </TableRow>
                                    ))}
                                    {!resumen.length && (
                                        <TableRow><TableCell colSpan={TIPOS.length + 3} className="text-center text-muted-foreground py-8">
                                            Sin actividad registrada en este periodo.
                                        </TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="semanal">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <CardTitle>Semana del {fmtFecha(lunes)} al {fmtFecha(finDeSemana(lunes))}</CardTitle>
                                    <CardDescription>Acciones por día de cada comercial</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => moverSemana(-7)}>
                                        <ChevronLeft className="h-4 w-4" /> Anterior
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setLunes(inicioDeSemana(new Date()))}>
                                        Esta semana
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => moverSemana(7)}>
                                        Siguiente <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Comercial</TableHead>
                                        {DIAS_SEMANA.map((d, i) => {
                                            const fecha = new Date(lunes);
                                            fecha.setDate(fecha.getDate() + i);
                                            return (
                                                <TableHead key={d} className="text-right">
                                                    {d.slice(0, 3)}
                                                    <span className="block text-[10px] font-normal text-muted-foreground">{fmtDiaCorto(fecha)}</span>
                                                </TableHead>
                                            );
                                        })}
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {semana.map(f => (
                                        <TableRow key={f.comercialNombre}>
                                            <TableCell className="font-medium">{f.comercialNombre}</TableCell>
                                            {f.porDia.map((n, i) => (
                                                <TableCell key={i} className="text-right">
                                                    {n || <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right font-bold">{f.total}</TableCell>
                                        </TableRow>
                                    ))}
                                    {!semana.length && (
                                        <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                            Sin actividad registrada esta semana.
                                        </TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="detalle">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalle de actividad</CardTitle>
                            <CardDescription>Una fila por acción. Es la hoja que se audita.</CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Comercial</TableHead>
                                        <TableHead>Actividad</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Estado kanban</TableHead>
                                        <TableHead>Detalle</TableHead>
                                        <TableHead>Atribución</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {conFecha.slice(0, 500).map((r, i) => (
                                        <TableRow key={`${r.clienteId}-${r.tipo}-${i}`}>
                                            <TableCell className="whitespace-nowrap text-sm">{fmtFechaHora(r.fecha)}</TableCell>
                                            <TableCell className="text-sm">{r.comercialNombre}</TableCell>
                                            <TableCell><Badge variant="outline">{TIPO_ETIQUETA[r.tipo]}</Badge></TableCell>
                                            <TableCell className="text-sm">{r.clienteNombre}</TableCell>
                                            <TableCell className="text-sm">{ESTADO_ETIQUETA[r.estadoKanban] || r.estadoKanban}</TableCell>
                                            <TableCell className="text-sm max-w-md truncate" title={r.detalle}>{r.detalle}</TableCell>
                                            <TableCell>
                                                {r.atribucion === 'confirmada'
                                                    ? <Badge variant="secondary">Confirmada</Badge>
                                                    : <Badge variant="outline" className="text-amber-600 border-amber-600">Inferida</Badge>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {!conFecha.length && (
                                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            Sin actividad con fecha en este periodo.
                                        </TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            {conFecha.length > 500 && (
                                <p className="text-xs text-muted-foreground mt-3">
                                    Mostrando las 500 más recientes de {conFecha.length}. El Excel las trae todas.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {sinFecha.length > 0 && (
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle className="text-base">Sin fecha registrada ({sinFecha.length})</CardTitle>
                                <CardDescription>
                                    Registros reales que no guardaron cuándo se hicieron, así que no pueden ubicarse
                                    en un día. Se listan aparte para no perderlos de vista.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Comercial</TableHead>
                                            <TableHead>Actividad</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Detalle</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sinFecha.slice(0, 200).map((r, i) => (
                                            <TableRow key={`sf-${r.clienteId}-${i}`}>
                                                <TableCell className="text-sm">{r.comercialNombre}</TableCell>
                                                <TableCell><Badge variant="outline">{TIPO_ETIQUETA[r.tipo]}</Badge></TableCell>
                                                <TableCell className="text-sm">{r.clienteNombre}</TableCell>
                                                <TableCell className="text-sm max-w-md truncate" title={r.detalle}>{r.detalle}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="kanban">
                    <Card>
                        <CardHeader>
                            <CardTitle>Clientes por estado del kanban</CardTitle>
                            <CardDescription>
                                Columna en la que está cada cliente hoy. El historial de cambios de columna
                                empieza a registrarse desde ahora, así que no puede reconstruirse hacia atrás.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Comercial</TableHead>
                                        {ESTADOS_KANBAN.map(e => <TableHead key={e} className="text-right">{ESTADO_ETIQUETA[e]}</TableHead>)}
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {kanban.map(f => (
                                        <TableRow key={f.comercialNombre}>
                                            <TableCell className="font-medium">{f.comercialNombre}</TableCell>
                                            {ESTADOS_KANBAN.map(e => (
                                                <TableCell key={e} className="text-right">
                                                    {f.porEstado[e] || <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right font-bold">{f.total}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
