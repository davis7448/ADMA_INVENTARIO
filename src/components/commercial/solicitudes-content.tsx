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
import { createSolicitud, getSolicitudesByEmail, type DistribucionStock, type EstadoSolicitud, type Modificacion, type TipoModificacion } from '@/app/actions/modificaciones';
import { syncSolicitudToClickUpAction } from '@/app/actions/clickup';
import { ProductSearchPicker } from '@/components/product-search-picker';
import type { Platform, Warehouse } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
                                                {s.tipoModificacion === 'CREACION_ITEM' ? 'Creación' : s.ES_RETIRO ? 'Retiro' : s.SOLICITUD === 'SUMA' ? 'Suma' : 'Ajuste'}
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

    const [tipo, setTipo] = useState<'CREACION_ITEM' | 'AJUSTE' | 'SUMA' | 'RETIRO'>('CREACION_ITEM');
    const [accionPriv, setAccionPriv] = useState<'sin_cambio' | 'privatizar' | 'quitar_privatizacion'>('sin_cambio');
    const [distribucion, setDistribucion] = useState<DistribucionStock[]>([]);
    const [sku, setSku] = useState('');
    const [productName, setProductName] = useState('');
    const [variable, setVariable] = useState('');
    const [pickedVariants, setPickedVariants] = useState<Array<{ id: string; name: string; sku: string; priceDropshipping?: number }>>([]);
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

    const handleProductPick = (product: { id: string; name: string; sku?: string; contentLink?: string; priceDropshipping?: number; productType?: string; variants?: Array<{ id: string; name: string; sku: string; priceDropshipping?: number }> }) => {
        setProductId(product.id);
        setProductName(product.name);
        setSku(product.sku || '');
        setVariable('');
        setPickedVariants(product.productType === 'variable' ? (product.variants || []) : []);
        if (product.contentLink) setEnlaceDrive(product.contentLink);
        if (product.priceDropshipping) setPrecio(String(product.priceDropshipping));
        toast({ title: 'Producto vinculado', description: product.name });
    };

    const handleVariantPick = (variantId: string) => {
        if (variantId === 'todas') {
            setVariable('');
            return;
        }
        const variant = pickedVariants.find(v => v.id === variantId);
        if (variant) {
            setVariable(variant.name);
            setSku(variant.sku);
            if (variant.priceDropshipping) setPrecio(String(variant.priceDropshipping));
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
        if (tipo === 'CREACION_ITEM' && visibilidad === 'Privado' && !correo.trim()) {
            toast({ title: 'Error', description: 'Para item privado debes indicar el correo de privatización.', variant: 'destructive' });
            return;
        }
        if (tipo !== 'CREACION_ITEM' && accionPriv === 'privatizar' && !correo.trim()) {
            toast({ title: 'Error', description: 'Para privatizar debes indicar el correo.', variant: 'destructive' });
            return;
        }
        if (tipo !== 'CREACION_ITEM' && !idPlataforma.trim()) {
            toast({ title: 'Error', description: 'Para ajustes, sumas o retiros indica el ID del item en la plataforma.', variant: 'destructive' });
            return;
        }
        const distribucionValida = distribucion.filter(d => d.cantidad > 0);
        for (const d of distribucionValida) {
            if (d.destino === 'privado' && !d.correo?.trim()) {
                toast({ title: 'Error', description: 'Cada reparto privado de la distribución necesita su correo.', variant: 'destructive' });
                return;
            }
        }

        setIsSaving(true);
        try {
            const esRetiro = tipo === 'RETIRO';
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
                'PRIVADO_PUBLICO': tipo === 'CREACION_ITEM'
                    ? visibilidad
                    : accionPriv === 'privatizar' ? 'Privado' : 'Publico',
                'CORREO_CODIGO': correo.trim() || null,
                CREADO: 'NO',
                SOLICITUD: (tipo === 'CREACION_ITEM' || tipo === 'SUMA') ? 'SUMA' : 'AJUSTE',
                'CANTIDAD PREVIA': null,
                'CANTIDAD SOLICITADA': esRetiro ? 0 : (stock ? Number(stock) : null),
                'CANTIDAD POSTERIOR': null,
                PAIS: pais,
                tipoModificacion: (tipo === 'CREACION_ITEM' ? 'CREACION_ITEM' : 'AJUSTE_STOCK') as TipoModificacion,
                productId: productId || undefined,
                ENLACE_DRIVE: enlaceDrive.trim() || undefined,
                TIPO_PRECIO: tipoPrecio,
                OBSERVACIONES: observaciones.trim() || undefined,
                ES_RETIRO: esRetiro || undefined,
                ACCION_PRIVATIZACION: tipo === 'CREACION_ITEM' ? undefined : accionPriv,
                DISTRIBUCION: distribucionValida.length > 0 ? distribucionValida : undefined,
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
                            <SelectItem value="RETIRO">Dejar ID en cero / retirar</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="col-span-2">
                    <Label>Producto del inventario</Label>
                    <div className="mt-1">
                        <ProductSearchPicker onSelect={handleProductPick} />
                    </div>
                    {productId && <p className="text-xs text-green-600 mt-1">✓ Vinculado al inventario{sku ? ` (SKU: ${sku})` : ''}</p>}
                </div>
                <div className="col-span-2">
                    <Label htmlFor="sol-name">Nombre del producto * <span className="text-muted-foreground font-normal">(editable si no está en inventario)</span></Label>
                    <Input id="sol-name" value={productName} onChange={e => { setProductName(e.target.value); }} className="mt-1" />
                </div>
                <div className="col-span-2">
                    <Label htmlFor="sol-sku">SKU</Label>
                    <Input id="sol-sku" value={sku} onChange={e => { setSku(e.target.value); setProductId(null); }} className="mt-1" placeholder="Se llena solo al elegir producto" />
                </div>
                <div className="col-span-2">
                    <Label htmlFor="sol-variable">¿A qué variante aplica esta solicitud?</Label>
                    {pickedVariants.length > 0 ? (
                        <>
                            <Select onValueChange={handleVariantPick}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Elige la variante del producto…" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todas / el producto completo</SelectItem>
                                    {pickedVariants.map(v => (
                                        <SelectItem key={v.id} value={v.id}>{v.name} — SKU {v.sku}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">Este producto tiene {pickedVariants.length} variantes registradas. Al elegir una, el SKU y el precio se actualizan solos. Si la solicitud reparte stock entre varias, usa la "Distribución del stock" más abajo.</p>
                        </>
                    ) : (
                        <>
                            <Input id="sol-variable" value={variable} onChange={e => setVariable(e.target.value)} className="mt-1" placeholder="Déjalo vacío si aplica al producto completo" />
                            <p className="text-xs text-muted-foreground mt-1">Solo si el producto tiene presentaciones distintas: escribe cuál aplica (ej: "Grado 2.0", "Talla M", "Combo x2"). Si aplica a todas, déjalo vacío.</p>
                        </>
                    )}
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
                    <Input id="sol-stock" type="number" min="0" value={tipo === 'RETIRO' ? '0' : stock} onChange={e => setStock(e.target.value)} className="mt-1" disabled={tipo === 'RETIRO'} />
                    {tipo === 'RETIRO' && <p className="text-xs text-muted-foreground mt-1">El ID quedará en cero.</p>}
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
                {tipo === 'CREACION_ITEM' ? (
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
                ) : (
                    <div>
                        <Label>Acción de privatización</Label>
                        <Select value={accionPriv} onValueChange={(v) => setAccionPriv(v as typeof accionPriv)}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sin_cambio">Sin cambio</SelectItem>
                                <SelectItem value="privatizar">Privatizar (por correo)</SelectItem>
                                <SelectItem value="quitar_privatizacion">Quitar privatización (dejar público)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
                {((tipo === 'CREACION_ITEM' && visibilidad === 'Privado') || (tipo !== 'CREACION_ITEM' && accionPriv === 'privatizar')) && (
                    <div className="col-span-2">
                        <Label htmlFor="sol-correo">Correo(s) de privatización *</Label>
                        <Input id="sol-correo" value={correo} onChange={e => setCorreo(e.target.value)} className="mt-1" placeholder="cliente@correo.com, otro@correo.com" />
                    </div>
                )}
                <div className="col-span-2 border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Distribución del stock <span className="text-muted-foreground font-normal">(opcional — reparto entre público/privado o variantes)</span></Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => setDistribucion(prev => [...prev, { cantidad: 0, destino: 'privado' }])}>+ Reparto</Button>
                    </div>
                    {distribucion.map((d, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                            <Input type="number" min="0" placeholder="Cant." value={d.cantidad || ''} className="w-20 h-8"
                                onChange={e => setDistribucion(prev => prev.map((x, j) => j === i ? { ...x, cantidad: Number(e.target.value) } : x))} />
                            <Select value={d.destino} onValueChange={v => setDistribucion(prev => prev.map((x, j) => j === i ? { ...x, destino: v as 'publico' | 'privado' } : x))}>
                                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="publico">Público</SelectItem>
                                    <SelectItem value="privado">Privado</SelectItem>
                                </SelectContent>
                            </Select>
                            {d.destino === 'privado' && (
                                <Input placeholder="correo@cliente.com" value={d.correo || ''} className="flex-1 min-w-[140px] h-8 text-xs"
                                    onChange={e => setDistribucion(prev => prev.map((x, j) => j === i ? { ...x, correo: e.target.value } : x))} />
                            )}
                            <Input placeholder="Variante (opc.)" value={d.variante || ''} className="w-32 h-8 text-xs"
                                onChange={e => setDistribucion(prev => prev.map((x, j) => j === i ? { ...x, variante: e.target.value } : x))} />
                            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => setDistribucion(prev => prev.filter((_, j) => j !== i))}>✕</Button>
                        </div>
                    ))}
                    {distribucion.length === 0 && (
                        <p className="text-xs text-muted-foreground">Ej: 75 unds privado a cliente@x.com (variante 1.5) + 75 unds público. La instrucción para plataformas se genera automáticamente.</p>
                    )}
                </div>
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
