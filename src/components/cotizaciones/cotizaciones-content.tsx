"use client";

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
    listarCotizaciones, historialCotizacion, cambiarEstadoCotizacion,
    obtenerDestinatarios, guardarDestinatarios,
    type CotizacionListada, type EventoHistorial,
} from '@/app/actions/cotizaciones';
import { ESTADO_LABEL, TRANSICIONES, type EstadoCotizacion } from '@/lib/cotizaciones-estados';
import { CATEGORIAS } from '@/lib/cotizador-catalogo';
import { CotizacionClickUpPanel } from '@/components/cotizaciones/cotizacion-clickup-panel';
import { Download, Loader2, Mail } from 'lucide-react';

const COLOR: Record<EstadoCotizacion, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    recibida: 'default', triage: 'secondary', esperando_cliente: 'outline',
    revision_tecnica: 'secondary', cotizada: 'default',
    aceptada: 'default', rechazada: 'destructive', cancelada: 'outline',
};

const fecha = (iso: string) => iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const nombreCategoria = (id: string) => CATEGORIAS.find(c => c.id === id)?.nombre || id;

export function CotizacionesContent() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [datos, setDatos] = useState<CotizacionListada[]>([]);
    const [cargando, setCargando] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('todas');
    const [busqueda, setBusqueda] = useState('');
    const [abierta, setAbierta] = useState<CotizacionListada | null>(null);
    const [historial, setHistorial] = useState<EventoHistorial[]>([]);
    const [motivo, setMotivo] = useState('');
    const [guardando, setGuardando] = useState(false);
    // Destinatarios del aviso: los administra un admin desde aquí, no viven en el código.
    const [notifAbierto, setNotifAbierto] = useState(false);
    const [destinatarios, setDestinatarios] = useState<string[]>([]);
    const [nuevoCorreo, setNuevoCorreo] = useState('');
    const esAdmin = user?.role === 'admin';

    const cargar = async () => {
        setCargando(true);
        try { setDatos(await listarCotizaciones()); }
        catch { toast({ title: 'Error', description: 'No se pudieron cargar las cotizaciones.', variant: 'destructive' }); }
        finally { setCargando(false); }
    };
    useEffect(() => { cargar(); }, []);

    const abrir = async (c: CotizacionListada) => {
        setAbierta(c); setMotivo(''); setHistorial([]);
        setHistorial(await historialCotizacion(c.id));
    };

    const mover = async (nuevo: EstadoCotizacion) => {
        if (!abierta || !user) return;
        setGuardando(true);
        const r = await cambiarEstadoCotizacion(abierta.id, nuevo, user.name || user.email || 'interno', motivo);
        setGuardando(false);
        if (!r.success) { toast({ title: 'No se pudo mover', description: r.error, variant: 'destructive' }); return; }
        toast({ title: 'Estado actualizado', description: `${abierta.referencia} → ${ESTADO_LABEL[nuevo]}` });
        await cargar();
        const actualizada = { ...abierta, estado: nuevo };
        setAbierta(actualizada);
        setHistorial(await historialCotizacion(abierta.id));
        setMotivo('');
    };

    const filtradas = useMemo(() => datos.filter(c => {
        if (filtroEstado !== 'todas' && c.estado !== filtroEstado) return false;
        if (!busqueda.trim()) return true;
        const t = busqueda.toLowerCase();
        return [c.referencia, c.nombre, c.empresa, c.email, c.ciudad].some(v => (v || '').toLowerCase().includes(t));
    }), [datos, filtroEstado, busqueda]);

    const descargar = () => {
        if (!filtradas.length) return;
        const ws = XLSX.utils.json_to_sheet(filtradas.map(c => ({
            Referencia: c.referencia, Estado: ESTADO_LABEL[c.estado], Recibida: fecha(c.creada),
            Categoría: nombreCategoria(c.categoria), Formas: c.formas.join(', '),
            Modalidad: c.modalidad, Formulación: c.rutaFormulacion,
            Presentación: c.presentacion, Cantidad: c.cantidad, 'Marca blanca': c.marcaBlanca ? 'Sí' : 'No',
            'Ruta regulatoria': c.rutaRegulatoria || '', Contacto: c.nombre, Empresa: c.empresa || '',
            Correo: c.email, Teléfono: c.telefono || '', Ciudad: c.ciudad, Mensaje: c.mensaje || '',
        })));
        ws['!cols'] = Object.keys(filtradas[0] || {}).map(() => ({ wch: 18 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cotizaciones');
        XLSX.writeFile(wb, `cotizaciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // Cuántas hay en cada estado: es lo primero que quiere saber quien abre la bandeja.
    const resumen = useMemo(() => {
        const m = new Map<string, number>();
        for (const c of datos) m.set(c.estado, (m.get(c.estado) || 0) + 1);
        return m;
    }, [datos]);

    if (cargando) return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;

    return (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Cotizaciones de maquila</h1>
                    <p className="text-sm text-muted-foreground">{datos.length} en total · {resumen.get('recibida') || 0} sin clasificar</p>
                </div>
                <div className="flex gap-2">
                    {esAdmin && (
                        <Button variant="outline" onClick={async () => { setDestinatarios(await obtenerDestinatarios()); setNotifAbierto(true); }}>
                            <Mail className="mr-2 h-4 w-4" /> Avisos por correo
                        </Button>
                    )}
                    <Button onClick={descargar} disabled={!filtradas.length}>
                        <Download className="mr-2 h-4 w-4" /> Descargar Excel
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                        <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todas">Todas</SelectItem>
                            {(Object.keys(ESTADO_LABEL) as EstadoCotizacion[]).map(e => (
                                <SelectItem key={e} value={e}>{ESTADO_LABEL[e]} ({resumen.get(e) || 0})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1 flex-1 min-w-[220px]">
                    <Label className="text-xs">Buscar</Label>
                    <Input placeholder="Referencia, nombre, empresa, correo o ciudad" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bandeja</CardTitle>
                    <CardDescription>{filtradas.length} cotización(es)</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Referencia</TableHead>
                                <TableHead>Recibida</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right">Cantidad</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtradas.map(c => (
                                <TableRow key={c.id} className="cursor-pointer" onClick={() => abrir(c)}>
                                    <TableCell className="font-mono text-sm">{c.referencia}</TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">{fecha(c.creada)}</TableCell>
                                    <TableCell className="text-sm">
                                        {c.nombre}{c.empresa ? <span className="text-muted-foreground"> · {c.empresa}</span> : null}
                                    </TableCell>
                                    <TableCell className="text-sm">{nombreCategoria(c.categoria)} · {c.formas.join(', ')}</TableCell>
                                    <TableCell className="text-right text-sm">{c.cantidad.toLocaleString('es-CO')}</TableCell>
                                    <TableCell><Badge variant={COLOR[c.estado]}>{ESTADO_LABEL[c.estado]}</Badge></TableCell>
                                </TableRow>
                            ))}
                            {!filtradas.length && (
                                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                    {datos.length ? 'Ninguna coincide con el filtro.' : 'Todavía no hay cotizaciones.'}
                                </TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={notifAbierto} onOpenChange={setNotifAbierto}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Avisos por correo</DialogTitle>
                        <DialogDescription>
                            A quién se le avisa cuando entra una cotización nueva. Si la lista está
                            vacía no sale ningún correo y las cotizaciones solo se ven aquí.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2">
                        <Input placeholder="correo@adma.com.co" value={nuevoCorreo}
                            onChange={e => setNuevoCorreo(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const c = nuevoCorreo.trim().toLowerCase();
                                    if (c && !destinatarios.includes(c)) setDestinatarios([...destinatarios, c]);
                                    setNuevoCorreo('');
                                }
                            }} className="h-9" />
                        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => {
                            const c = nuevoCorreo.trim().toLowerCase();
                            if (c && !destinatarios.includes(c)) setDestinatarios([...destinatarios, c]);
                            setNuevoCorreo('');
                        }}>Añadir</Button>
                    </div>
                    <div className="space-y-1">
                        {destinatarios.map(c => (
                            <div key={c} className="flex items-center justify-between rounded-md border px-2 py-1.5 text-sm">
                                <span>{c}</span>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
                                    onClick={() => setDestinatarios(destinatarios.filter(x => x !== c))}>Quitar</Button>
                            </div>
                        ))}
                        {!destinatarios.length && <p className="text-xs text-muted-foreground">Sin destinatarios: no se enviará ningún aviso.</p>}
                    </div>
                    <Button disabled={guardando} onClick={async () => {
                        setGuardando(true);
                        const r = await guardarDestinatarios(destinatarios, user?.email || '');
                        setGuardando(false);
                        if (r.success) { toast({ title: 'Guardado', description: `${destinatarios.length} destinatario(s).` }); setNotifAbierto(false); }
                        else toast({ title: 'No se pudo guardar', description: r.error, variant: 'destructive' });
                    }}>
                        {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar
                    </Button>
                </DialogContent>
            </Dialog>

            <Dialog open={!!abierta} onOpenChange={o => !o && setAbierta(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {abierta && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="font-mono">{abierta.referencia}</DialogTitle>
                                <DialogDescription>{abierta.nombre} · {abierta.email}{abierta.telefono ? ` · ${abierta.telefono}` : ''}</DialogDescription>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <Dato k="Categoría" v={nombreCategoria(abierta.categoria)} />
                                <Dato k="Formas" v={abierta.formas.join(', ')} />
                                <Dato k="Modalidad" v={abierta.modalidad} />
                                <Dato k="Formulación" v={abierta.rutaFormulacion} />
                                <Dato k="Presentación" v={abierta.presentacion} />
                                <Dato k="Cantidad" v={abierta.cantidad.toLocaleString('es-CO')} />
                                <Dato k="Marca blanca" v={abierta.marcaBlanca ? 'Sí' : 'No'} />
                                <Dato k="Ruta regulatoria" v={abierta.rutaRegulatoria || '—'} />
                                <Dato k="Ciudad" v={abierta.ciudad} />
                                {abierta.empresa && <Dato k="Empresa" v={abierta.empresa} />}
                            </div>
                            {(abierta.ingredientesIncluir.length > 0 || abierta.ingredientesEvitar.length > 0) && (
                                <div className="text-sm space-y-1">
                                    {abierta.ingredientesIncluir.length > 0 && <p><span className="text-muted-foreground">Incluir:</span> {abierta.ingredientesIncluir.join(', ')}</p>}
                                    {abierta.ingredientesEvitar.length > 0 && <p><span className="text-muted-foreground">Evitar:</span> {abierta.ingredientesEvitar.join(', ')}</p>}
                                </div>
                            )}
                            {abierta.mensaje && <p className="text-sm border rounded-md p-2 bg-muted/30">{abierta.mensaje}</p>}

                            <div className="border-t pt-3 space-y-2">
                                <Label className="text-sm">Mover a</Label>
                                {TRANSICIONES[abierta.estado].length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        "{ESTADO_LABEL[abierta.estado]}" es un estado final: no admite más cambios.
                                    </p>
                                ) : (
                                    <>
                                        <Input placeholder="Motivo (queda en el historial)" value={motivo} onChange={e => setMotivo(e.target.value)} className="h-9" />
                                        <div className="flex flex-wrap gap-2">
                                            {TRANSICIONES[abierta.estado].map(e => (
                                                <Button key={e} size="sm" variant="outline" disabled={guardando} onClick={() => mover(e)}>
                                                    {guardando && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                                    {ESTADO_LABEL[e]}
                                                </Button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <CotizacionClickUpPanel
                                cotizacionId={abierta.id}
                                taskId={abierta.clickupTaskId}
                                url={abierta.clickupUrl}
                                actor={user?.name || user?.email || 'interno'}
                                // Tras crear la tarea hay que releer: `abierta` es la copia
                                // vieja y todavía no tiene el clickupTaskId.
                                onSincronizada={async () => {
                                    const frescas = await listarCotizaciones();
                                    setDatos(frescas);
                                    const actualizada = frescas.find(c => c.id === abierta.id);
                                    if (actualizada) {
                                        setAbierta(actualizada);
                                        setHistorial(await historialCotizacion(actualizada.id));
                                    }
                                }}
                            />

                            <div className="border-t pt-3">
                                <Label className="text-sm">Historial</Label>
                                <div className="mt-1 space-y-1">
                                    {historial.map((h, i) => (
                                        <p key={i} className="text-xs text-muted-foreground">
                                            {fecha(h.fecha)} · {h.estadoAnterior ? `${ESTADO_LABEL[h.estadoAnterior as EstadoCotizacion]} → ` : ''}
                                            <strong>{ESTADO_LABEL[h.estadoNuevo as EstadoCotizacion]}</strong> · {h.actor}
                                            {h.motivo ? ` · ${h.motivo}` : ''}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Dato({ k, v }: { k: string; v: string }) {
    return <p><span className="text-muted-foreground">{k}:</span> {v}</p>;
}
