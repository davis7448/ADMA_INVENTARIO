"use client";

import { useEffect, useRef, useState } from 'react';
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
import { syncSolicitudToClickUpAction, uploadSolicitudImagesAction } from '@/app/actions/clickup';
import { buildObservacionesText } from '@/lib/solicitud-text';
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

const PASOS = [
    { n: 1, titulo: 'Producto' },
    { n: 2, titulo: 'Plataforma' },
    { n: 3, titulo: 'Visibilidad' },
    { n: 4, titulo: 'Confirmar' },
];

function SolicitudFormDialog({ platforms, warehouses, onCreated }: {
    platforms: Platform[];
    warehouses: Warehouse[];
    onCreated: () => void;
}) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [paso, setPaso] = useState(1);

    const [tipo, setTipo] = useState<'CREACION_ITEM' | 'AJUSTE' | 'SUMA' | 'RETIRO'>('CREACION_ITEM');
    const [accionPriv, setAccionPriv] = useState<'sin_cambio' | 'privatizar' | 'quitar_privatizacion'>('sin_cambio');
    const [distribucion, setDistribucion] = useState<DistribucionStock[]>([]);
    const [sku, setSku] = useState('');
    const [productName, setProductName] = useState('');
    const [variable, setVariable] = useState('');
    const [pickedVariants, setPickedVariants] = useState<Array<{ id: string; name: string; sku: string; priceDropshipping?: number }>>([]);
    const [comboMode, setComboMode] = useState(false);
    const [comboNombre, setComboNombre] = useState('');
    const [comboUnidades, setComboUnidades] = useState('');
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
    const imagesInputRef = useRef<HTMLInputElement>(null);
    const [imageCount, setImageCount] = useState(0);
    // Stock por variante (cuando el producto tiene variantes y la solicitud aplica a varias)
    const [variantStocks, setVariantStocks] = useState<Record<string, string>>({});

    const esRetiro = tipo === 'RETIRO';
    const esCreacion = tipo === 'CREACION_ITEM';
    // Correos de los repartos privados: si existen, son LOS correos de privatización
    // (no se pide otro campo aparte)
    const correosDeRepartos = Array.from(new Set(
        distribucion
            .filter(d => d.cantidad > 0 && d.destino === 'privado' && d.correo?.trim())
            .map(d => d.correo!.trim())
    ));
    const quierePrivatizar = (esCreacion && visibilidad === 'Privado') || (!esCreacion && accionPriv === 'privatizar');
    const necesitaCorreo = quierePrivatizar && correosDeRepartos.length === 0;
    // Grilla por variante activa cuando hay variantes y no se eligió una específica ni combo
    const usaStockPorVariante = pickedVariants.length > 0 && !variable && !comboMode && !esRetiro;
    const stockPorVariante = pickedVariants
        .map(v => ({ variante: v.name, sku: v.sku, cantidad: Number(variantStocks[v.id] || 0) }))
        .filter(v => v.cantidad > 0);
    const totalVariantes = stockPorVariante.reduce((acc, v) => acc + v.cantidad, 0);

    const resetAll = () => {
        setPaso(1); setTipo('CREACION_ITEM'); setAccionPriv('sin_cambio'); setDistribucion([]);
        setSku(''); setProductName(''); setVariable(''); setPickedVariants([]);
        setComboMode(false); setComboNombre(''); setComboUnidades('');
        setProductId(null); setEnlaceDrive(''); setPlataforma(''); setBodega('');
        setPais('COLOMBIA'); setStock(''); setPrecio(''); setTipoPrecio('DROPSHIPPING');
        setVisibilidad('Publico'); setCorreo(''); setIdPlataforma(''); setObservaciones('');
        setImageCount(0);
        setVariantStocks({});
        if (imagesInputRef.current) imagesInputRef.current.value = '';
    };

    const handleProductPick = (product: { id: string; name: string; sku?: string; contentLink?: string; priceDropshipping?: number; productType?: string; variants?: Array<{ id: string; name: string; sku: string; priceDropshipping?: number }> }) => {
        setProductId(product.id);
        setProductName(product.name);
        setSku(product.sku || '');
        setVariable('');
        setComboMode(false);
        setComboNombre('');
        setComboUnidades('');
        setPickedVariants(product.productType === 'variable' ? (product.variants || []) : []);
        setVariantStocks({});
        if (product.contentLink) setEnlaceDrive(product.contentLink);
        if (product.priceDropshipping) setPrecio(String(product.priceDropshipping));
    };

    const handleVariantPick = (variantId: string) => {
        if (variantId === 'nuevo_combo') {
            setComboMode(true);
            setVariable('');
            return;
        }
        setComboMode(false);
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

    // Validación por paso; devuelve el error o null si puede avanzar
    const validarPaso = (n: number): string | null => {
        if (n === 1) {
            if (!productName.trim()) return 'Busca el producto en el inventario o escribe su nombre.';
            if (comboMode && (!comboNombre.trim() || !comboUnidades || Number(comboUnidades) < 2)) {
                return 'Para el combo indica su nombre y cuántas unidades del producto trae (mínimo 2).';
            }
            return null;
        }
        if (n === 2) {
            if (!plataforma) return 'Selecciona la plataforma.';
            if (!esCreacion && !idPlataforma.trim()) return 'Indica el ID del item en la plataforma (aparece en Dropi/la plataforma).';
            if (comboMode && (!stock || Number(stock) <= 0)) return 'Indica cuántos paquetes/combos se solicitan.';
            if (usaStockPorVariante && tipo !== 'AJUSTE' && totalVariantes <= 0) return 'Indica el stock de al menos una variante.';
            if (!usaStockPorVariante && !esRetiro && !comboMode && tipo !== 'AJUSTE' && (!stock || Number(stock) <= 0)) return 'Indica el stock solicitado.';
            return null;
        }
        if (n === 3) {
            for (const d of distribucion.filter(x => x.cantidad > 0)) {
                if (d.destino === 'privado' && !d.correo?.trim()) return 'Cada reparto privado necesita su correo.';
            }
            if (necesitaCorreo && !correo.trim()) return 'Indica el correo de privatización (o agrega repartos privados con sus correos).';
            return null;
        }
        return null;
    };

    const avanzar = () => {
        const error = validarPaso(paso);
        if (error) {
            toast({ title: 'Falta información', description: error, variant: 'destructive' });
            return;
        }
        setPaso(p => Math.min(4, p + 1));
    };

    // Correo(s) finales de privatización: el campo único, o los de los repartos privados
    const correoFinal = correo.trim() || (correosDeRepartos.length > 0 ? correosDeRepartos.join(', ') : '');

    // Objeto parcial para la vista previa de la instrucción (paso 4)
    const solicitudPreview: Partial<Modificacion> = {
        'CANTIDAD SOLICITADA': esRetiro ? 0 : usaStockPorVariante ? totalVariantes : (stock ? Number(stock) : null),
        STOCK_POR_VARIANTE: usaStockPorVariante && stockPorVariante.length > 0 ? stockPorVariante : undefined,
        VARIABLE: comboMode ? comboNombre.trim() : (variable.trim() || null),
        CORREO_CODIGO: correoFinal || null,
        OBSERVACIONES: observaciones.trim() || undefined,
        ES_RETIRO: esRetiro || undefined,
        ACCION_PRIVATIZACION: esCreacion ? undefined : accionPriv,
        DISTRIBUCION: distribucion.filter(d => d.cantidad > 0),
        COMBO: comboMode ? { nombre: comboNombre.trim(), unidadesPorCombo: Number(comboUnidades) } : undefined,
    };
    const instruccionGenerada = buildObservacionesText(solicitudPreview);

    const handleSubmit = async () => {
        if (!user) return;
        for (const n of [1, 2, 3]) {
            const error = validarPaso(n);
            if (error) {
                setPaso(n);
                toast({ title: 'Falta información', description: error, variant: 'destructive' });
                return;
            }
        }

        setIsSaving(true);
        try {
            const distribucionValida = distribucion.filter(d => d.cantidad > 0);
            const solicitudId = await createSolicitud({
                FECHA: Date.now(),
                ID: idPlataforma.trim() ? Number(idPlataforma) || null : null,
                PRODUCTO: productName.trim(),
                VARIABLE: comboMode ? comboNombre.trim() : (variable.trim() || null),
                'SKU ': sku.trim() || null,
                'PRECIO ': precio ? Number(precio) : null,
                PLATAFORMA: plataforma,
                BODEGA: bodega || null,
                COMERCIAL: user.name,
                'CODIGO COMERCIAL': user.commercialCode || user.email,
                'PRIVADO_PUBLICO': esCreacion ? visibilidad : accionPriv === 'privatizar' ? 'Privado' : 'Publico',
                'CORREO_CODIGO': correoFinal || null,
                CREADO: 'NO',
                SOLICITUD: (esCreacion || tipo === 'SUMA') ? 'SUMA' : 'AJUSTE',
                'CANTIDAD PREVIA': null,
                'CANTIDAD SOLICITADA': esRetiro ? 0 : usaStockPorVariante ? totalVariantes : (stock ? Number(stock) : null),
                'CANTIDAD POSTERIOR': null,
                PAIS: pais,
                tipoModificacion: (esCreacion ? 'CREACION_ITEM' : 'AJUSTE_STOCK') as TipoModificacion,
                productId: productId || undefined,
                ENLACE_DRIVE: enlaceDrive.trim() || undefined,
                TIPO_PRECIO: tipoPrecio,
                OBSERVACIONES: observaciones.trim() || undefined,
                ES_RETIRO: esRetiro || undefined,
                ACCION_PRIVATIZACION: esCreacion ? undefined : accionPriv,
                DISTRIBUCION: distribucionValida.length > 0 ? distribucionValida : undefined,
                COMBO: comboMode ? { nombre: comboNombre.trim(), unidadesPorCombo: Number(comboUnidades) } : undefined,
                STOCK_POR_VARIANTE: usaStockPorVariante && stockPorVariante.length > 0 ? stockPorVariante : undefined,
                solicitadoPor: { id: user.id, name: user.name, email: user.email },
            } as Omit<Modificacion, 'ID CONSECUTIVO'>);

            // Tarea espejo en ClickUp (si falla, el cron la reintenta)
            const sync = await syncSolicitudToClickUpAction(solicitudId);

            // Imágenes: van directo a ClickUp como adjuntos, no a Firebase
            let imagenesMsg = '';
            const files = Array.from(imagesInputRef.current?.files || []);
            if (files.length > 0) {
                if (sync.success && sync.taskId) {
                    const formData = new FormData();
                    for (const file of files) formData.append('images', file);
                    const upload = await uploadSolicitudImagesAction(sync.taskId, formData);
                    imagenesMsg = upload.success
                        ? ` ${upload.uploaded} imagen(es) adjuntada(s) en ClickUp.`
                        : ' Algunas imágenes no se pudieron adjuntar: reenvíalas desde ClickUp.';
                } else {
                    imagenesMsg = ' Las imágenes no se adjuntaron (ClickUp no disponible): agrégalas a la tarea cuando se sincronice.';
                }
            }

            toast({
                title: '¡Solicitud enviada!',
                description: (sync.success
                    ? 'Quedó pendiente para plataformas (sincronizada con ClickUp).'
                    : 'Quedó pendiente en ADMA; la sincronización con ClickUp se reintentará automáticamente.') + imagenesMsg,
            });
            resetAll();
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
                <DialogDescription>Paso {paso} de 4 — {PASOS[paso - 1].titulo}. Fecha y comercial se registran automáticamente.</DialogDescription>
            </DialogHeader>

            {/* Indicador de pasos */}
            <div className="flex items-center gap-1">
                {PASOS.map(p => (
                    <button
                        key={p.n}
                        type="button"
                        onClick={() => p.n < paso && setPaso(p.n)}
                        className={`flex-1 h-1.5 rounded-full transition-colors ${p.n <= paso ? 'bg-primary' : 'bg-muted'} ${p.n < paso ? 'cursor-pointer' : 'cursor-default'}`}
                        title={p.titulo}
                    />
                ))}
            </div>

            {/* PASO 1 — Qué necesitas y sobre qué producto */}
            {paso === 1 && (
                <div className="space-y-4 py-2">
                    <div>
                        <Label>¿Qué necesitas?</Label>
                        <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CREACION_ITEM">Crear un item nuevo en plataforma</SelectItem>
                                <SelectItem value="SUMA">Sumar stock (recarga de un item existente)</SelectItem>
                                <SelectItem value="AJUSTE">Ajustar stock de un item existente</SelectItem>
                                <SelectItem value="RETIRO">Dejar el ID en cero / retirar</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Busca el producto</Label>
                        <div className="mt-1">
                            <ProductSearchPicker onSelect={handleProductPick} />
                        </div>
                        {productId
                            ? <p className="text-xs text-green-600 mt-1">✓ Vinculado al inventario{sku ? ` (SKU: ${sku})` : ''}</p>
                            : <p className="text-xs text-muted-foreground mt-1">Si el producto aún no existe en inventario, escribe su nombre y SKU abajo.</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                            <Label htmlFor="sol-name">Nombre del producto *</Label>
                            <Input id="sol-name" value={productName} onChange={e => setProductName(e.target.value)} className="mt-1" />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <Label htmlFor="sol-sku">SKU</Label>
                            <Input id="sol-sku" value={sku} onChange={e => { setSku(e.target.value); setProductId(null); }} className="mt-1" />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="sol-variable">¿Aplica a una variante?</Label>
                        {pickedVariants.length > 0 ? (
                            <>
                                <Select onValueChange={handleVariantPick}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Elige la variante del producto…" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todas">Varias variantes (repartirás el stock en el siguiente paso)</SelectItem>
                                        {pickedVariants.map(v => (
                                            <SelectItem key={v.id} value={v.id}>Solo: {v.name} — SKU {v.sku}</SelectItem>
                                        ))}
                                        <SelectItem value="nuevo_combo">➕ Crear combo/variante nueva…</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">Si eliges una sola variante, el SKU y el precio se actualizan solos. Si eliges "Varias", en el paso 2 pondrás el stock de cada una.</p>
                            </>
                        ) : (
                            <>
                                <div className="flex gap-2 mt-1">
                                    <Input id="sol-variable" value={variable} onChange={e => setVariable(e.target.value)} placeholder="Déjalo vacío si aplica al producto completo" disabled={comboMode} className="flex-1" />
                                    <Button type="button" variant={comboMode ? 'default' : 'outline'} size="sm" className="h-10 whitespace-nowrap" onClick={() => setComboMode(!comboMode)}>
                                        {comboMode ? '✓ Combo nuevo' : '+ Combo (x2, x3…)'}
                                    </Button>
                                </div>
                                {!comboMode && <p className="text-xs text-muted-foreground mt-1">Ej: "Grado 2.0", "Talla M". Para un combo/paquete nuevo (ej: Bella Skin x2), usa el botón.</p>}
                            </>
                        )}
                        {comboMode && (
                            <div className="mt-2 border rounded-lg p-3 space-y-2 bg-muted/30">
                                <p className="text-sm font-medium">Combo / paquete nuevo</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label htmlFor="combo-nombre" className="text-xs">Nombre del combo *</Label>
                                        <Input id="combo-nombre" value={comboNombre} onChange={e => setComboNombre(e.target.value)} className="mt-1 h-9" placeholder="Ej: Combo x2" />
                                    </div>
                                    <div>
                                        <Label htmlFor="combo-unidades" className="text-xs">Unidades por combo *</Label>
                                        <Input id="combo-unidades" type="number" min="2" value={comboUnidades} onChange={e => setComboUnidades(e.target.value)} className="mt-1 h-9" placeholder="Ej: 2" />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">En el siguiente paso, el Stock será el número de paquetes.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PASO 2 — Plataforma y cantidades */}
            {paso === 2 && (
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
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
                        {!esCreacion && (
                            <div>
                                <Label htmlFor="sol-idp">ID en plataforma *</Label>
                                <Input id="sol-idp" value={idPlataforma} onChange={e => setIdPlataforma(e.target.value)} className="mt-1" placeholder="Ej: 2158539" />
                            </div>
                        )}
                        {!usaStockPorVariante && (
                            <div>
                                <Label htmlFor="sol-stock">{comboMode ? 'Nº de paquetes/combos *' : 'Stock'}</Label>
                                <Input id="sol-stock" type="number" min="0" value={esRetiro ? '0' : stock} onChange={e => setStock(e.target.value)} className="mt-1" disabled={esRetiro} />
                                {esRetiro && <p className="text-xs text-muted-foreground mt-1">El ID quedará en cero.</p>}
                                {comboMode && stock && comboUnidades && (
                                    <p className="text-xs text-muted-foreground mt-1">= {Number(stock) * Number(comboUnidades)} unidades del producto base</p>
                                )}
                            </div>
                        )}
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
                    </div>
                    {usaStockPorVariante && (
                        <div className="border rounded-lg p-3 space-y-2">
                            <Label>Stock por variante *</Label>
                            <p className="text-xs text-muted-foreground">Indica las unidades por variante (deja en blanco las que no aplican).</p>
                            <div className="space-y-1.5">
                                {pickedVariants.map(v => (
                                    <div key={v.id} className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate">{v.name}</p>
                                            <p className="text-xs text-muted-foreground font-mono">SKU {v.sku}</p>
                                        </div>
                                        <Input
                                            type="number" min="0" placeholder="0"
                                            value={variantStocks[v.id] || ''}
                                            onChange={e => setVariantStocks(prev => ({ ...prev, [v.id]: e.target.value }))}
                                            className="w-24 h-9 text-right"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm font-medium text-right border-t pt-2">Total: {totalVariantes.toLocaleString('es-CO')} unidades</p>
                        </div>
                    )}
                </div>
            )}

            {/* PASO 3 — Visibilidad y distribución */}
            {paso === 3 && (
                <div className="space-y-4 py-2">
                    {esCreacion ? (
                        <div>
                            <Label>¿El item nuevo es público o privado?</Label>
                            <Select value={visibilidad} onValueChange={(v) => setVisibilidad(v as typeof visibilidad)}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Publico">Público (visible para todos los clientes)</SelectItem>
                                    <SelectItem value="Privado">Privado (solo para correos específicos)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div>
                            <Label>¿Hay que cambiar la privatización del item?</Label>
                            <Select value={accionPriv} onValueChange={(v) => setAccionPriv(v as typeof accionPriv)}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sin_cambio">No, dejarlo como está</SelectItem>
                                    <SelectItem value="privatizar">Privatizar (asignarlo a correos)</SelectItem>
                                    <SelectItem value="quitar_privatizacion">Quitar privatización (dejarlo público)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {necesitaCorreo && (
                        <div>
                            <Label htmlFor="sol-correo">Correo(s) de privatización *</Label>
                            <Input id="sol-correo" value={correo} onChange={e => setCorreo(e.target.value)} className="mt-1" placeholder="cliente@correo.com, otro@correo.com" />
                        </div>
                    )}
                    {quierePrivatizar && correosDeRepartos.length > 0 && (
                        <p className="text-xs text-muted-foreground">✓ Se usarán los correos de los repartos privados: {correosDeRepartos.join(', ')}</p>
                    )}
                    <div className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Repartir el stock <span className="text-muted-foreground font-normal">(opcional)</span></Label>
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
                            <p className="text-xs text-muted-foreground">Solo si el stock se divide entre público/privado o entre variantes. Ej: 75 unds privado a cliente@x.com + 75 público.</p>
                        )}
                    </div>
                </div>
            )}

            {/* PASO 4 — Contenido, imágenes y confirmación */}
            {paso === 4 && (
                <div className="space-y-4 py-2">
                    <div>
                        <Label htmlFor="sol-drive">Enlace Drive (contenido)</Label>
                        <Input id="sol-drive" value={enlaceDrive} onChange={e => setEnlaceDrive(e.target.value)} className="mt-1" placeholder="https://drive.google.com/…" />
                    </div>
                    <div>
                        <Label htmlFor="sol-images">Imágenes específicas <span className="text-muted-foreground font-normal">(se adjuntan a la tarea de ClickUp)</span></Label>
                        <Input id="sol-images" ref={imagesInputRef} type="file" accept="image/*" multiple className="mt-1"
                            onChange={e => setImageCount(e.target.files?.length || 0)} />
                        {imageCount > 0 && <p className="text-xs text-muted-foreground mt-1">{imageCount} imagen(es) seleccionada(s) — irán directo a ClickUp, no se guardan en ADMA.</p>}
                    </div>
                    <div>
                        <Label htmlFor="sol-obs">Observaciones adicionales</Label>
                        <Textarea id="sol-obs" value={observaciones} onChange={e => setObservaciones(e.target.value)} className="mt-1 resize-none h-16" placeholder="Solo si hay algo que no quedó cubierto en los pasos anteriores" />
                    </div>
                    <div className="border rounded-lg p-3 bg-muted/30 space-y-1 text-sm">
                        <p className="font-medium">Resumen</p>
                        <p><span className="text-muted-foreground">Tipo:</span> {esCreacion ? 'Creación de item' : esRetiro ? 'Retiro / dejar en cero' : tipo === 'SUMA' ? 'Suma de stock' : 'Ajuste de stock'}</p>
                        <p><span className="text-muted-foreground">Producto:</span> {productName || '—'}{sku ? ` (${sku})` : ''}</p>
                        <p><span className="text-muted-foreground">Plataforma:</span> {plataforma || '—'} · {pais}{bodega ? ` · ${bodega}` : ''}{idPlataforma ? ` · ID ${idPlataforma}` : ''}</p>
                        <p><span className="text-muted-foreground">Stock:</span> {esRetiro ? '0 (retiro)' : usaStockPorVariante ? `${totalVariantes} unds en ${stockPorVariante.length} variante(s)` : (stock || '—')}{comboMode && stock && comboUnidades ? ` paquetes (${Number(stock) * Number(comboUnidades)} unds)` : ''} · <span className="text-muted-foreground">Precio:</span> {precio ? `$${Number(precio).toLocaleString('es-CO')}` : '—'}</p>
                        {instruccionGenerada && (
                            <p className="pt-1 border-t mt-2"><span className="text-muted-foreground">Instrucción para plataformas:</span> {instruccionGenerada}</p>
                        )}
                    </div>
                </div>
            )}

            <DialogFooter className="gap-2">
                {paso > 1 && <Button variant="outline" onClick={() => setPaso(p => p - 1)} disabled={isSaving}>Atrás</Button>}
                <DialogClose asChild><Button variant="ghost" disabled={isSaving}>Cancelar</Button></DialogClose>
                {paso < 4
                    ? <Button onClick={avanzar}>Siguiente</Button>
                    : <Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? 'Enviando…' : 'Enviar Solicitud'}</Button>}
            </DialogFooter>
        </DialogContent>
    );
}
