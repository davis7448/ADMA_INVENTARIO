"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
    getReceptionAction, countReceptionItemAction, addItemRealPhotosAction,
    setReceptionItemLocationAction, finishCountingAction, verifyReceptionAction,
    loadReceptionInventoryAction,
} from '@/app/actions/receptions';
import { RECEPTION_STATUS_LABELS, RECEPTION_STATUS_VARIANT } from './receptions-content';
import type { Category, Location, Reception, ReceptionItem, Supplier } from '@/lib/types';
import { AlertTriangle, ArrowLeft, Camera, Check, ShieldCheck, Truck } from 'lucide-react';

interface ReceptionDetailContentProps {
    receptionId: string;
    categories: Category[];
    suppliers: Supplier[];
    locations: Location[];
}

export function ReceptionDetailContent({ receptionId, categories, suppliers, locations }: ReceptionDetailContentProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [reception, setReception] = useState<Reception | null>(null);
    const [items, setItems] = useState<ReceptionItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isWorking, setIsWorking] = useState(false);
    const [galleryItem, setGalleryItem] = useState<ReceptionItem | null>(null);
    // Categoría/proveedor elegidos para crear los productos nuevos al cargar
    const [newProductDefaults, setNewProductDefaults] = useState<Record<string, { categoryId: string; vendorId: string }>>({});

    const canCount = !!user && ['admin', 'logistics'].includes(user.role);
    const canVerify = !!user && ['admin', 'coordinacion'].includes(user.role);
    const isEditable = reception?.status === 'en_conteo' || reception?.status === 'con_discrepancia';

    const load = async () => {
        setIsLoading(true);
        try {
            const result = await getReceptionAction(receptionId);
            setReception(result.reception);
            setItems(result.items);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudo cargar la recepción.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, [receptionId]);

    const handleFinishCounting = async () => {
        setIsWorking(true);
        try {
            const result = await finishCountingAction(receptionId);
            if (result.success) {
                toast({
                    title: result.status === 'con_discrepancia' ? 'Conteo con discrepancias' : 'Conteo verificado',
                    description: result.status === 'con_discrepancia'
                        ? 'Hay líneas que no coinciden: requiere verificación de Coordinación Operativa.'
                        : 'Todo coincide. Puedes cargar el inventario.',
                });
                load();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsWorking(false);
        }
    };

    const handleVerify = async () => {
        if (!user) return;
        setIsWorking(true);
        try {
            const result = await verifyReceptionAction(receptionId, { id: user.id, name: user.name });
            if (result.success) {
                toast({ title: 'Recepción verificada', description: 'Las discrepancias fueron revisadas y aprobadas.' });
                load();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsWorking(false);
        }
    };

    const handleLoadInventory = async () => {
        if (!user) return;
        const newItems = items.filter(i => !i.productId && !i.inventoryLoaded);
        for (const item of newItems) {
            const defaults = newProductDefaults[item.id];
            if (!defaults?.categoryId || !defaults?.vendorId) {
                toast({ title: 'Falta información', description: `La línea ${item.sku} es producto nuevo: selecciona categoría y proveedor.`, variant: 'destructive' });
                return;
            }
        }
        setIsWorking(true);
        try {
            const result = await loadReceptionInventoryAction(receptionId, user as any, newProductDefaults);
            if (result.success) {
                toast({ title: '¡Inventario cargado!', description: `${result.loaded} línea(s) cargada(s) con su movimiento de entrada.` });
                load();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsWorking(false);
        }
    };

    if (isLoading) {
        return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
    }

    if (!reception) {
        return (
            <div className="text-center space-y-4 py-12">
                <p className="text-muted-foreground">La recepción no existe.</p>
                <Button variant="outline" onClick={() => router.push('/logistics/recepciones')}><ArrowLeft className="h-4 w-4 mr-2" />Volver</Button>
            </div>
        );
    }

    const discrepancies = items.filter(i => i.match === false);
    const hasNewProducts = items.some(i => !i.productId && !i.inventoryLoaded);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/logistics/recepciones')}><ArrowLeft className="h-5 w-5" /></Button>
                    <div>
                        <h1 className="text-2xl font-bold font-headline tracking-tight">{reception.receptionNumber}</h1>
                        <p className="text-muted-foreground text-sm">
                            Orden {reception.purchaseOrderNumber} · Recibe: {reception.receivedBy?.name}
                            {reception.verifiedBy ? ` · Verifica: ${reception.verifiedBy.name}` : ''}
                        </p>
                    </div>
                </div>
                <Badge variant={RECEPTION_STATUS_VARIANT[reception.status]} className="text-sm">{RECEPTION_STATUS_LABELS[reception.status]}</Badge>
            </div>

            {reception.status === 'con_discrepancia' && (
                <div className="border border-destructive/40 bg-destructive/5 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="flex-1">
                        <p className="font-medium">Hay {discrepancies.length} línea(s) con discrepancia</p>
                        <p className="text-sm text-muted-foreground">Coordinación Operativa debe revisar las notas y aprobar antes de cargar el inventario.</p>
                    </div>
                    {canVerify && (
                        <Button onClick={handleVerify} disabled={isWorking}>
                            <ShieldCheck className="h-4 w-4 mr-2" />{isWorking ? 'Verificando…' : 'Verificar y Aprobar'}
                        </Button>
                    )}
                </div>
            )}

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Conteo por Línea</CardTitle>
                            <CardDescription>
                                Cuenta cajas y unidades reales; si no coinciden con lo esperado, la nota de discrepancia es obligatoria.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {reception.status === 'en_conteo' && canCount && (
                                <Button onClick={handleFinishCounting} disabled={isWorking}>
                                    <Check className="h-4 w-4 mr-2" />{isWorking ? 'Cerrando…' : 'Finalizar Conteo'}
                                </Button>
                            )}
                            {reception.status === 'verificada' && (canCount || canVerify) && (
                                <Button onClick={handleLoadInventory} disabled={isWorking}>
                                    <Truck className="h-4 w-4 mr-2" />{isWorking ? 'Cargando…' : 'Cargar a Inventario'}
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>SKU</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Esperado</TableHead>
                                <TableHead>Contado (unid / cajas)</TableHead>
                                <TableHead>Fotos</TableHead>
                                <TableHead>Ubicación</TableHead>
                                {hasNewProducts && reception.status === 'verificada' && <TableHead>Cat. / Prov. (nuevo)</TableHead>}
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map(item => (
                                <ReceptionItemRow
                                    key={item.id}
                                    item={item}
                                    locations={locations}
                                    categories={categories}
                                    suppliers={suppliers}
                                    canCount={canCount && isEditable}
                                    showNewProductSelects={!!(hasNewProducts && reception.status === 'verificada' && !item.productId && !item.inventoryLoaded)}
                                    newProductDefaults={newProductDefaults[item.id]}
                                    onDefaultsChange={(defaults) => setNewProductDefaults(prev => ({ ...prev, [item.id]: defaults }))}
                                    onCounted={load}
                                    onOpenGallery={() => setGalleryItem(item)}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <RealPhotosDialog
                item={galleryItem}
                onClose={() => setGalleryItem(null)}
                canAddPhotos={canCount && (isEditable || reception.status === 'verificada')}
                onPhotosAdded={load}
            />
        </div>
    );
}

function ReceptionItemRow({ item, locations, categories, suppliers, canCount, showNewProductSelects, newProductDefaults, onDefaultsChange, onCounted, onOpenGallery }: {
    item: ReceptionItem;
    locations: Location[];
    categories: Category[];
    suppliers: Supplier[];
    canCount: boolean;
    showNewProductSelects: boolean;
    newProductDefaults?: { categoryId: string; vendorId: string };
    onDefaultsChange: (defaults: { categoryId: string; vendorId: string }) => void;
    onCounted: () => void;
    onOpenGallery: () => void;
}) {
    const { toast } = useToast();
    const [units, setUnits] = useState(item.countedUnits?.toString() ?? '');
    const [boxes, setBoxes] = useState(item.countedBoxes?.toString() ?? '');
    const [notes, setNotes] = useState(item.discrepancyNotes ?? '');
    const [isSaving, setIsSaving] = useState(false);

    const unitsNum = units === '' ? undefined : Number(units);
    const mismatch = unitsNum !== undefined && (
        unitsNum !== item.expectedUnits ||
        (item.expectedBoxes !== undefined && boxes !== '' && Number(boxes) !== item.expectedBoxes)
    );

    const handleSave = async () => {
        if (unitsNum === undefined || isNaN(unitsNum)) {
            toast({ title: 'Error', description: 'Ingresa las unidades contadas.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            const result = await countReceptionItemAction(item.id, {
                countedUnits: unitsNum,
                countedBoxes: boxes === '' ? undefined : Number(boxes),
                discrepancyNotes: notes,
            });
            if (result.success) {
                toast({
                    title: result.match ? 'Conteo coincide ✓' : 'Discrepancia registrada',
                    description: `${item.sku}: ${unitsNum} unidades contadas.`,
                });
                onCounted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleLocationChange = async (locationId: string) => {
        const result = await setReceptionItemLocationAction(item.id, locationId === 'none' ? null : locationId);
        if (!result.success) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    return (
        <TableRow className={item.match === false ? 'bg-destructive/5' : undefined}>
            <TableCell className="font-mono text-xs">{item.sku}</TableCell>
            <TableCell className="font-medium">{item.productName}</TableCell>
            <TableCell>
                <Badge variant={item.entryType === 'nuevo' ? 'default' : 'secondary'}>
                    {item.entryType === 'nuevo' ? 'Nuevo' : 'Recarga'}
                </Badge>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
                {item.expectedUnits.toLocaleString('es-CO')} u{item.expectedBoxes !== undefined ? ` / ${item.expectedBoxes} cj` : ''}
            </TableCell>
            <TableCell>
                {canCount ? (
                    <div className="space-y-1 min-w-[190px]">
                        <div className="flex items-center gap-1">
                            <Input type="number" min="0" placeholder="Unid." value={units} onChange={e => setUnits(e.target.value)} className="w-20 h-8 text-right" />
                            <Input type="number" min="0" placeholder="Cajas" value={boxes} onChange={e => setBoxes(e.target.value)} className="w-20 h-8 text-right" />
                            <Button size="sm" className="h-8" onClick={handleSave} disabled={isSaving}>{isSaving ? '…' : 'OK'}</Button>
                        </div>
                        {mismatch && (
                            <Input placeholder="Nota de discrepancia (obligatoria)" value={notes} onChange={e => setNotes(e.target.value)} className="h-8 text-xs" />
                        )}
                    </div>
                ) : (
                    <span className="whitespace-nowrap">
                        {item.countedUnits !== undefined ? `${item.countedUnits.toLocaleString('es-CO')} u${item.countedBoxes !== undefined ? ` / ${item.countedBoxes} cj` : ''}` : '—'}
                    </span>
                )}
                {item.match === false && item.discrepancyNotes && (
                    <p className="text-xs text-destructive mt-1">⚠ {item.discrepancyNotes}</p>
                )}
            </TableCell>
            <TableCell>
                <Button variant="outline" size="sm" onClick={onOpenGallery}>
                    <Camera className="h-4 w-4 mr-1" />{item.realPhotos?.length || 0}
                </Button>
            </TableCell>
            <TableCell>
                <Select defaultValue={item.locationId || 'none'} onValueChange={handleLocationChange} disabled={!canCount && item.inventoryLoaded}>
                    <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Ubicación" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Sin ubicación</SelectItem>
                        {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableCell>
            {showNewProductSelects && (
                <TableCell>
                    <div className="space-y-1 min-w-[150px]">
                        <Select value={newProductDefaults?.categoryId || ''} onValueChange={(v) => onDefaultsChange({ categoryId: v, vendorId: newProductDefaults?.vendorId || '' })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoría…" /></SelectTrigger>
                            <SelectContent>
                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={newProductDefaults?.vendorId || ''} onValueChange={(v) => onDefaultsChange({ categoryId: newProductDefaults?.categoryId || '', vendorId: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Proveedor…" /></SelectTrigger>
                            <SelectContent>
                                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </TableCell>
            )}
            <TableCell>
                {item.inventoryLoaded ? (
                    <Badge variant="outline" className="whitespace-nowrap">✓ Cargado{item.movementId ? ` #${item.movementId}` : ''}</Badge>
                ) : item.match === undefined ? (
                    <Badge variant="secondary">Sin contar</Badge>
                ) : item.match ? (
                    <Badge variant="default">Coincide</Badge>
                ) : (
                    <Badge variant="destructive">Discrepancia</Badge>
                )}
            </TableCell>
        </TableRow>
    );
}

function RealPhotosDialog({ item, onClose, canAddPhotos, onPhotosAdded }: {
    item: ReceptionItem | null;
    onClose: () => void;
    canAddPhotos: boolean;
    onPhotosAdded: () => void;
}) {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async () => {
        if (!item || !fileInputRef.current?.files?.length) return;
        setIsUploading(true);
        try {
            const formData = new FormData();
            for (const file of Array.from(fileInputRef.current.files)) {
                formData.append('photos', file);
            }
            const result = await addItemRealPhotosAction(item.id, formData);
            if (result.success) {
                toast({ title: '¡Éxito!', description: `${result.photos?.length} foto(s) real(es) agregada(s).` });
                fileInputRef.current.value = '';
                onPhotosAdded();
                onClose();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Fotos Reales — {item?.sku}</DialogTitle>
                    <DialogDescription>{item?.productName} · Fotos tomadas al recibir la mercancía.</DialogDescription>
                </DialogHeader>
                {item?.realPhotos?.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {item.realPhotos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <Image src={url} alt={`Foto real ${i + 1}`} width={200} height={200} className="rounded-md object-cover aspect-square w-full" />
                            </a>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">Sin fotos reales aún.</p>
                )}
                {canAddPhotos && (
                    <div className="flex items-end gap-2 pt-2 border-t">
                        <div className="flex-1">
                            <Label htmlFor="real-photos">Agregar fotos</Label>
                            <Input id="real-photos" ref={fileInputRef} type="file" accept="image/*" multiple className="mt-1" />
                        </div>
                        <Button onClick={handleUpload} disabled={isUploading}>{isUploading ? 'Subiendo…' : 'Subir'}</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
