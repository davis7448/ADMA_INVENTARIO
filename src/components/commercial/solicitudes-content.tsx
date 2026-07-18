"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { createSolicitud, getSolicitudesByEmail, type EstadoSolicitud, type Modificacion, type TipoModificacion } from '@/app/actions/modificaciones';
import { syncSolicitudToClickUpAction } from '@/app/actions/clickup';
import { findProductBySkuAction } from '@/app/actions/purchase-orders';
import type { Platform, Warehouse } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search } from 'lucide-react';

const PAISES = ['COLOMBIA', 'MEXICO', 'ECUADOR', 'PARAGUAY', 'ARGENTINA', 'GUATEMALA'];

export const ESTADO_SOLICITUD_LABELS: Record<EstadoSolicitud, string> = {
    pendiente: 'Pendiente',
    en_revision: 'En Revisión',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
    creado: 'Creado',
    completado: 'Completado',
};

export const ESTADO_SOLICITUD_VARIANT: Record<EstadoSolicitud, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pendiente: 'secondary',
    en_revision: 'default',
    aprobado: 'default',
    rechazado: 'destructive',
    creado: 'outline',
    completado: 'outline',
};

interface SolicitudesContentProps {
    platforms: Platform[];
    warehouses: Warehouse[];
}

export function SolicitudesContent({ platforms, warehouses }: SolicitudesContentProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [solicitudes, setSolicitudes] = useState<(Modificacion & { id: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

    const load = async () => {
        if (!user?.email) return;
        setIsLoading(true);
        try {
            setSolicitudes(await getSolicitudesByEmail(user.email));
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudieron cargar tus solicitudes.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, [user?.email]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Solicitudes a Plataformas</h1>
                    <p className="text-muted-foreground">Creación de items, ajustes y sumas de stock. Reemplaza el formulario de ClickUp.</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild><Button>Nueva Solicitud</Button></DialogTrigger>
                    <SolicitudFormDialog
                        platforms={platforms}
                        warehouses={warehouses}
                        onCreated={() => { setDialogOpen(false); load(); }}
                    />
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Mis Solicitudes</CardTitle>
                    <CardDescription>{solicitudes.length} solicitudes</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {isLoading ? <Skeleton className="h-32 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Plataforma</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                    <TableHead className="text-right">Precio</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {solicitudes.length > 0 ? solicitudes.map(s => (
                                    <TableRow key={s.id}>
                                        <TableCell className="whitespace-nowrap">{s.FECHA ? format(new Date(s.FECHA), 'dd MMM HH:mm', { locale: es }) : '—'}</TableCell>
                                        <TableCell>
                                            <Badge variant={s.tipoModificacion === 'CREACION_ITEM' ? 'default' : 'secondary'}>
                                                {s.tipoModificacion === 'CREACION_ITEM' ? 'Creación' : s.SOLICITUD === 'SUMA' ? 'Suma' : 'Ajuste'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium max-w-[220px] truncate">{s.PRODUCTO || '—'}</TableCell>
                                        <TableCell className="font-mono text-xs">{s['SKU '] || '—'}</TableCell>
                                        <TableCell>{s.PLATAFORMA || '—'}</TableCell>
                                        <TableCell className="text-right">{s['CANTIDAD SOLICITADA'] ?? '—'}</TableCell>
                                        <TableCell className="text-right">{s['PRECIO '] ? `$${Number(s['PRECIO ']).toLocaleString('es-CO')}` : '—'}</TableCell>
                                        <TableCell>
                                            <div>
                                                <Badge variant={ESTADO_SOLICITUD_VARIANT[(s.estadoSolicitud || 'pendiente') as EstadoSolicitud]}>
                                                    {ESTADO_SOLICITUD_LABELS[(s.estadoSolicitud || 'pendiente') as EstadoSolicitud]}
                                                </Badge>
                                                {s.estadoSolicitud === 'rechazado' && s.motivoRechazo && (
                                                    <p className="text-xs text-destructive mt-1 max-w-[200px]">{s.motivoRechazo}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">Aún no has creado solicitudes.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function SolicitudFormDialog({ platforms, warehouses, onCreated }: {
    platforms: Platform[];
    warehouses: Warehouse[];
    onCreated: () => void;
}) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const [tipo, setTipo] = useState<'CREACION_ITEM' | 'AJUSTE' | 'SUMA'>('CREACION_ITEM');
    const [sku, setSku] = useState('');
    const [productName, setProductName] = useState('');
    const [variable, setVariable] = useState('');
    const [productId, setProductId] = useState<string | null>(null);
    const [enlaceDrive, setEnlaceDrive] = useState('');
    const [plataforma, setPlataforma] = useState('');
    const [bodega, setBodega] = useState('');
    const [pais, setPais] = useState('COLOMBIA');
    const [stock, setStock] = useState('');
    const [precio, setPrecio] = useState('');
    const [tipoPrecio, setTipoPrecio] = useState<'DROPSHIPPING' | 'ESPECIAL'>('DROPSHIPPING');
    const [visibilidad, setVisibilidad] = useState<'Publico' | 'Privado'>('Publico');
    const [correo, setCorreo] = useState('');
    const [idPlataforma, setIdPlataforma] = useState('');
    const [observaciones, setObservaciones] = useState('');

    const handleSearchSku = async () => {
        if (!sku.trim()) return;
        setIsSearching(true);
        try {
            const result = await findProductBySkuAction(sku);
            if (result.found && result.productId) {
                setProductId(result.productId);
                setProductName(result.productName || '');
                if (result.contentLink) setEnlaceDrive(result.contentLink);
                if (result.priceDropshipping) setPrecio(String(result.priceDropshipping));
                toast({ title: 'Producto encontrado', description: result.productName });
            } else {
                setProductId(null);
                toast({ title: 'SKU no encontrado', description: 'No existe en inventario. Verifica el SKU o escribe el nombre manualmente.', variant: 'destructive' });
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleSubmit = async () => {
        if (!user) return;
        if (!productName.trim()) {
            toast({ title: 'Error', description: 'Busca el producto por SKU o escribe su nombre.', variant: 'destructive' });
            return;
        }
        if (!plataforma) {
            toast({ title: 'Error', description: 'Selecciona la plataforma.', variant: 'destructive' });
            return;
        }
        if (visibilidad === 'Privado' && !correo.trim()) {
            toast({ title: 'Error', description: 'Para item privado debes indicar el correo de privatización.', variant: 'destructive' });
            return;
        }
        if (tipo !== 'CREACION_ITEM' && !idPlataforma.trim()) {
            toast({ title: 'Error', description: 'Para ajustes/sumas indica el ID del item en la plataforma.', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            const solicitudId = await createSolicitud({
                FECHA: Date.now(),
                ID: idPlataforma.trim() ? Number(idPlataforma) || null : null,
                PRODUCTO: productName.trim(),
                VARIABLE: variable.trim() || null,
                'SKU ': sku.trim() || null,
                'PRECIO ': precio ? Number(precio) : null,
                PLATAFORMA: plataforma,
                BODEGA: bodega || null,
                COMERCIAL: user.name,
                'CODIGO COMERCIAL': user.commercialCode || user.email,
                'PRIVADO_PUBLICO': visibilidad,
                'CORREO_CODIGO': correo.trim() || null,
                CREADO: 'NO',
                SOLICITUD: tipo === 'CREACION_ITEM' ? 'SUMA' : tipo,
                'CANTIDAD PREVIA': null,
                'CANTIDAD SOLICITADA': stock ? Number(stock) : null,
                'CANTIDAD POSTERIOR': null,
                PAIS: pais,
                tipoModificacion: (tipo === 'CREACION_ITEM' ? 'CREACION_ITEM' : 'AJUSTE_STOCK') as TipoModificacion,
                productId: productId || undefined,
                ENLACE_DRIVE: enlaceDrive.trim() || undefined,
                TIPO_PRECIO: tipoPrecio,
                OBSERVACIONES: observaciones.trim() || undefined,
                solicitadoPor: { id: user.id, name: user.name, email: user.email },
            } as Omit<Modificacion, 'ID CONSECUTIVO'>);

            // Crear la tarea espejo en ClickUp (si falla, el cron de respaldo la reintenta)
            const sync = await syncSolicitudToClickUpAction(solicitudId);
            toast({
                title: '¡Solicitud enviada!',
                description: sync.success
                    ? 'Quedó pendiente para el equipo de plataformas (sincronizada con ClickUp).'
                    : 'Quedó pendiente en ADMA; la sincronización con ClickUp se reintentará automáticamente.',
            });
            onCreated();
        } catch (error) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo crear la solicitud.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Nueva Solicitud a Plataformas</DialogTitle>
                <DialogDescription>Creación de item, ajuste o suma de stock. Fecha y comercial se registran automáticamente.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2">
                <div className="col-span-2">
                    <Label>Tipo de solicitud</Label>
                    <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="CREACION_ITEM">Creación de item nuevo</SelectItem>
                            <SelectItem value="AJUSTE">Ajuste de stock</SelectItem>
                            <SelectItem value="SUMA">Suma de stock (recarga)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="col-span-2">
                    <Label htmlFor="sol-sku">SKU del producto</Label>
                    <div className="flex gap-2 mt-1">
                        <Input id="sol-sku" value={sku} onChange={e => { setSku(e.target.value); setProductId(null); }} placeholder="Busca en inventario" />
                        <Button type="button" variant="outline" onClick={handleSearchSku} disabled={isSearching}>
                            <Search className="h-4 w-4 mr-1" />{isSearching ? '…' : 'Buscar'}
                        </Button>
                    </div>
                    {productId && <p className="text-xs text-green-600 mt-1">✓ Vinculado al inventario</p>}
                </div>
                <div className="col-span-2">
                    <Label htmlFor="sol-name">Nombre del producto *</Label>
                    <Input id="sol-name" value={productName} onChange={e => setProductName(e.target.value)} className="mt-1" />
                </div>
                <div className="col-span-2">
                    <Label htmlFor="sol-variable">Variable / variante <span className="text-muted-foreground">(color, talla, presentación…)</span></Label>
                    <Input id="sol-variable" value={variable} onChange={e => setVariable(e.target.value)} className="mt-1" placeholder="Ej: Grado 2.0 / Talla M / x2 unidades" />
                </div>
                <div>
                    <Label>Plataforma *</Label>
                    <Select value={plataforma} onValueChange={setPlataforma}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                        <SelectContent>
                            {platforms.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Bodega</Label>
                    <Select value={bodega} onValueChange={setBodega}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                        <SelectContent>
                            {warehouses.filter(w => w.type !== 'external').map(w => <SelectItem key={w.id} value={w.name}>{w.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>País *</Label>
                    <Select value={pais} onValueChange={setPais}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {PAISES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {tipo !== 'CREACION_ITEM' && (
                    <div>
                        <Label htmlFor="sol-idp">ID en plataforma *</Label>
                        <Input id="sol-idp" value={idPlataforma} onChange={e => setIdPlataforma(e.target.value)} className="mt-1" placeholder="Ej: 2158539" />
                    </div>
                )}
                <div>
                    <Label htmlFor="sol-stock">Stock</Label>
                    <Input id="sol-stock" type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className="mt-1" />
                </div>
                <div>
                    <Label htmlFor="sol-precio">Precio (COP)</Label>
                    <Input id="sol-precio" type="number" min="0" value={precio} onChange={e => setPrecio(e.target.value)} className="mt-1" />
                </div>
                <div>
                    <Label>Tipo de precio</Label>
                    <Select value={tipoPrecio} onValueChange={(v) => setTipoPrecio(v as typeof tipoPrecio)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DROPSHIPPING">Dropshipping</SelectItem>
                            <SelectItem value="ESPECIAL">Especial</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Visibilidad del item</Label>
                    <Select value={visibilidad} onValueChange={(v) => setVisibilidad(v as typeof visibilidad)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Publico">Público (todos los clientes)</SelectItem>
                            <SelectItem value="Privado">Privado (por correo)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {visibilidad === 'Privado' && (
                    <div className="col-span-2">
                        <Label htmlFor="sol-correo">Correo(s) de privatización *</Label>
                        <Input id="sol-correo" value={correo} onChange={e => setCorreo(e.target.value)} className="mt-1" placeholder="cliente@correo.com, otro@correo.com" />
                    </div>
                )}
                <div className="col-span-2">
                    <Label htmlFor="sol-drive">Enlace Drive (contenido)</Label>
                    <Input id="sol-drive" value={enlaceDrive} onChange={e => setEnlaceDrive(e.target.value)} className="mt-1" placeholder="https://drive.google.com/…" />
                </div>
                <div className="col-span-2">
                    <Label htmlFor="sol-obs">Observaciones o variantes</Label>
                    <Textarea id="sol-obs" value={observaciones} onChange={e => setObservaciones(e.target.value)} className="mt-1 resize-none h-16" />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? 'Enviando…' : 'Enviar Solicitud'}</Button>
            </DialogFooter>
        </DialogContent>
    );
}
