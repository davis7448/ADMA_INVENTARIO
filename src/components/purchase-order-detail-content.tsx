"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
    getPurchaseOrderAction, updatePurchaseOrderAction,
    addPurchaseOrderItemAction, updatePurchaseOrderItemAction, deletePurchaseOrderItemAction,
    addItemInspectionPhotosAction, findProductBySkuAction,
} from '@/app/actions/purchase-orders';
import { PO_STATUS_LABELS } from './purchase-orders-content';
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Supplier, Warehouse } from '@/lib/types';
import { ArrowLeft, Camera, ExternalLink, Search, Trash2 } from 'lucide-react';

const ITEM_STATUS_LABELS: Record<PurchaseOrderItem['status'], string> = {
    documentada: 'Documentada',
    en_transito: 'En Tránsito',
    recibida: 'Recibida',
    almacenada: 'Almacenada',
    liquidada: 'Liquidada',
    activada: 'Activada',
};

const CONTENT_STATUS_LABELS: Record<PurchaseOrderItem['contentStatus'], string> = {
    pendiente: 'Pendiente',
    en_proceso: 'En Proceso',
    listo: 'Listo',
};

const formatCOP = (value?: number) =>
    value === undefined || value === null ? '—' : `$${value.toLocaleString('es-CO')}`;

interface PurchaseOrderDetailContentProps {
    orderId: string;
    suppliers: Supplier[];
    warehouses: Warehouse[];
}

export function PurchaseOrderDetailContent({ orderId, suppliers, warehouses }: PurchaseOrderDetailContentProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [items, setItems] = useState<PurchaseOrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [itemDialogOpen, setItemDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [galleryItem, setGalleryItem] = useState<PurchaseOrderItem | null>(null);

    const canEdit = !!user && ['admin', 'coordinacion'].includes(user.role);
    const canEditContent = canEdit || user?.role === 'marketing';

    const load = async () => {
        setIsLoading(true);
        try {
            const result = await getPurchaseOrderAction(orderId);
            setOrder(result.order);
            setItems(result.items);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudo cargar la orden.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, [orderId]);

    const handleStatusChange = async (status: PurchaseOrderStatus) => {
        const result = await updatePurchaseOrderAction(orderId, { status });
        if (result.success) {
            toast({ title: '¡Éxito!', description: `Orden marcada como ${PO_STATUS_LABELS[status]}.` });
            load();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    const handleContentStatusChange = async (item: PurchaseOrderItem, contentStatus: PurchaseOrderItem['contentStatus']) => {
        const result = await updatePurchaseOrderItemAction(item.id, { contentStatus });
        if (result.success) {
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, contentStatus } : i));
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    const handleContentLinkSave = async (item: PurchaseOrderItem, contentLink: string) => {
        const result = await updatePurchaseOrderItemAction(item.id, { contentLink });
        if (result.success) {
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, contentLink } : i));
            toast({ title: '¡Éxito!', description: 'Link de contenido actualizado.' });
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    const handleDeleteItem = async (item: PurchaseOrderItem) => {
        if (!confirm(`¿Eliminar la línea ${item.sku} — ${item.productName}?`)) return;
        const result = await deletePurchaseOrderItemAction(item.id);
        if (result.success) {
            setItems(prev => prev.filter(i => i.id !== item.id));
            toast({ title: 'Línea eliminada.' });
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };

    const supplierName = suppliers.find(s => s.id === order?.supplierId)?.name || '—';
    const warehouseName = warehouses.find(w => w.id === order?.warehouseId)?.name || '—';
    const totalUnits = items.reduce((acc, i) => acc + (i.expectedUnits || 0), 0);
    const totalBoxes = items.reduce((acc, i) => acc + (i.expectedBoxes || 0), 0);

    if (isLoading) {
        return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
    }

    if (!order) {
        return (
            <div className="text-center space-y-4 py-12">
                <p className="text-muted-foreground">La orden de compra no existe.</p>
                <Button variant="outline" onClick={() => router.push('/compras')}><ArrowLeft className="h-4 w-4 mr-2" />Volver</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/compras')}><ArrowLeft className="h-5 w-5" /></Button>
                    <div>
                        <h1 className="text-2xl font-bold font-headline tracking-tight">{order.orderNumber}</h1>
                        <p className="text-muted-foreground text-sm">
                            {supplierName} · Bodega: {warehouseName}
                            {order.groupackRef ? ` · Groupack: ${order.groupackRef}` : ''}
                            {order.estimatedArrivalDate ? ` · Llega: ${order.estimatedArrivalDate}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <Button variant="outline" onClick={() => router.push(`/compras/${orderId}/liquidacion`)}>Liquidar</Button>
                    )}
                    {canEdit ? (
                        <Select value={order.status} onValueChange={(v) => handleStatusChange(v as PurchaseOrderStatus)}>
                            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(PO_STATUS_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Badge>{PO_STATUS_LABELS[order.status]}</Badge>
                    )}
                </div>
            </div>

            {order.notes && <p className="text-sm text-muted-foreground border-l-2 pl-3">{order.notes}</p>}

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Líneas de la Orden</CardTitle>
                            <CardDescription>{items.length} líneas · {totalUnits.toLocaleString('es-CO')} unidades · {totalBoxes.toLocaleString('es-CO')} cajas</CardDescription>
                        </div>
                        {canEdit && <Button onClick={() => setItemDialogOpen(true)}>Agregar Línea</Button>}
                    </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>SKU</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Unid.</TableHead>
                                <TableHead className="text-right">Cajas</TableHead>
                                <TableHead className="text-right">CBM/u</TableHead>
                                <TableHead className="text-right">Costo Prod.</TableHead>
                                <TableHead className="text-right">Costo Est.</TableHead>
                                <TableHead>Fotos</TableHead>
                                <TableHead>Contenido</TableHead>
                                <TableHead>Estado</TableHead>
                                {canEdit && <TableHead />}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length > 0 ? items.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                    <TableCell>
                                        <Badge variant={item.entryType === 'nuevo' ? 'default' : 'secondary'}>
                                            {item.entryType === 'nuevo' ? 'Nuevo' : 'Recarga'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{item.expectedUnits.toLocaleString('es-CO')}</TableCell>
                                    <TableCell className="text-right">{item.expectedBoxes ?? '—'}</TableCell>
                                    <TableCell className="text-right">{item.cbmPerUnit ?? '—'}</TableCell>
                                    <TableCell className="text-right">{formatCOP(item.productCost)}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCOP(item.unitCostEstimated)}</TableCell>
                                    <TableCell>
                                        <Button variant="outline" size="sm" onClick={() => setGalleryItem(item)}>
                                            <Camera className="h-4 w-4 mr-1" />{item.inspectionPhotos?.length || 0}
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {canEditContent ? (
                                                <Select value={item.contentStatus} onValueChange={(v) => handleContentStatusChange(item, v as PurchaseOrderItem['contentStatus'])}>
                                                    <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(CONTENT_STATUS_LABELS).map(([value, label]) => (
                                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Badge variant="outline">{CONTENT_STATUS_LABELS[item.contentStatus]}</Badge>
                                            )}
                                            {item.contentLink ? (
                                                <a href={item.contentLink} target="_blank" rel="noopener noreferrer">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-4 w-4" /></Button>
                                                </a>
                                            ) : canEditContent ? (
                                                <Button
                                                    variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground"
                                                    onClick={() => {
                                                        const link = prompt('Link de Drive del contenido:');
                                                        if (link) handleContentLinkSave(item, link.trim());
                                                    }}
                                                >+ Drive</Button>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{ITEM_STATUS_LABELS[item.status]}</Badge></TableCell>
                                    {canEdit && (
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteItem(item)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={canEdit ? 12 : 11} className="h-24 text-center">
                                        Sin líneas. {canEdit ? 'Agrega la primera línea con SKU y cantidades.' : ''}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {canEdit && (
                <AddItemDialog
                    open={itemDialogOpen}
                    onOpenChange={setItemDialogOpen}
                    purchaseOrderId={orderId}
                    onItemAdded={load}
                />
            )}

            <PhotoGalleryDialog
                item={galleryItem}
                onClose={() => setGalleryItem(null)}
                canAddPhotos={canEdit}
                onPhotosAdded={load}
            />
        </div>
    );
}

// --- Dialog: agregar línea ---

function AddItemDialog({ open, onOpenChange, purchaseOrderId, onItemAdded }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    purchaseOrderId: string;
    onItemAdded: () => void;
}) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [sku, setSku] = useState('');
    const [productName, setProductName] = useState('');
    const [linkedProductId, setLinkedProductId] = useState<string | null>(null);
    const [expectedUnits, setExpectedUnits] = useState('');
    const [expectedBoxes, setExpectedBoxes] = useState('');
    const [unitsPerBox, setUnitsPerBox] = useState('');
    const [cbmPerUnit, setCbmPerUnit] = useState('');
    const [productCost, setProductCost] = useState('');
    const [contentLink, setContentLink] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setSku(''); setProductName(''); setLinkedProductId(null);
        setExpectedUnits(''); setExpectedBoxes(''); setUnitsPerBox('');
        setCbmPerUnit(''); setProductCost(''); setContentLink('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSearchSku = async () => {
        if (!sku.trim()) return;
        setIsSearching(true);
        try {
            const result = await findProductBySkuAction(sku);
            if (result.found && result.productId) {
                setLinkedProductId(result.productId);
                setProductName(result.productName || '');
                toast({ title: 'Producto encontrado', description: `Se vinculará como reabastecimiento de "${result.productName}".` });
            } else {
                setLinkedProductId(null);
                toast({ title: 'SKU nuevo', description: 'No existe en inventario: la línea quedará como producto nuevo.' });
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        try {
            const formData = new FormData();
            formData.set('purchaseOrderId', purchaseOrderId);
            formData.set('sku', sku);
            formData.set('productName', productName);
            if (linkedProductId) formData.set('productId', linkedProductId);
            formData.set('expectedUnits', expectedUnits);
            if (expectedBoxes) formData.set('expectedBoxes', expectedBoxes);
            if (unitsPerBox) formData.set('unitsPerBox', unitsPerBox);
            if (cbmPerUnit) formData.set('cbmPerUnit', cbmPerUnit);
            if (productCost) formData.set('productCost', productCost);
            if (contentLink) formData.set('contentLink', contentLink);
            for (const file of Array.from(fileInputRef.current?.files || [])) {
                formData.append('inspectionPhotos', file);
            }

            const result = await addPurchaseOrderItemAction(formData);
            if (result.success) {
                toast({ title: '¡Éxito!', description: 'Línea agregada a la orden.' });
                reset();
                onOpenChange(false);
                onItemAdded();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Agregar Línea</DialogTitle>
                    <DialogDescription>
                        Busca el SKU: si ya existe en inventario se vincula como reabastecimiento; si no, quedará como producto nuevo por crear en recepción.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-2">
                    <div className="col-span-2">
                        <Label htmlFor="item-sku">SKU *</Label>
                        <div className="flex gap-2 mt-1">
                            <Input id="item-sku" value={sku} onChange={e => { setSku(e.target.value); setLinkedProductId(null); }} placeholder="SKU del producto" />
                            <Button type="button" variant="outline" onClick={handleSearchSku} disabled={isSearching}>
                                <Search className="h-4 w-4 mr-1" />{isSearching ? 'Buscando…' : 'Buscar'}
                            </Button>
                        </div>
                        {linkedProductId && <p className="text-xs text-green-600 mt-1">✓ Vinculado a producto existente (reabastecimiento)</p>}
                    </div>
                    <div className="col-span-2">
                        <Label htmlFor="item-name">Nombre del producto *</Label>
                        <Input id="item-name" value={productName} onChange={e => setProductName(e.target.value)} className="mt-1" disabled={!!linkedProductId} />
                    </div>
                    <div>
                        <Label htmlFor="item-units">Unidades esperadas *</Label>
                        <Input id="item-units" type="number" min="1" value={expectedUnits} onChange={e => setExpectedUnits(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                        <Label htmlFor="item-boxes">Cajas esperadas</Label>
                        <Input id="item-boxes" type="number" min="0" value={expectedBoxes} onChange={e => setExpectedBoxes(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                        <Label htmlFor="item-upb">Unidades por caja</Label>
                        <Input id="item-upb" type="number" min="0" value={unitsPerBox} onChange={e => setUnitsPerBox(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                        <Label htmlFor="item-cbm">CBM por unidad (m³)</Label>
                        <Input id="item-cbm" type="number" min="0" step="0.0001" value={cbmPerUnit} onChange={e => setCbmPerUnit(e.target.value)} className="mt-1" placeholder="Ej: 0.012" />
                    </div>
                    <div className="col-span-2">
                        <Label htmlFor="item-cost">Costo del producto (COP, sin importación)</Label>
                        <Input id="item-cost" type="number" min="0" value={productCost} onChange={e => setProductCost(e.target.value)} className="mt-1" />
                        <p className="text-xs text-muted-foreground mt-1">El costo estimado se calcula automático: costo + tarifa × CBM.</p>
                    </div>
                    <div className="col-span-2">
                        <Label htmlFor="item-drive">Link de contenido (Drive)</Label>
                        <Input id="item-drive" value={contentLink} onChange={e => setContentLink(e.target.value)} className="mt-1" placeholder="https://drive.google.com/…" />
                    </div>
                    <div className="col-span-2">
                        <Label htmlFor="item-photos">Fotos de inspección (origen)</Label>
                        <Input id="item-photos" ref={fileInputRef} type="file" accept="image/*" multiple className="mt-1" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? 'Guardando…' : 'Agregar Línea'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Dialog: galería de fotos de inspección ---

function PhotoGalleryDialog({ item, onClose, canAddPhotos, onPhotosAdded }: {
    item: PurchaseOrderItem | null;
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
            const result = await addItemInspectionPhotosAction(item.id, formData);
            if (result.success) {
                toast({ title: '¡Éxito!', description: `${result.photos?.length} foto(s) agregada(s).` });
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
                    <DialogTitle>Fotos de Inspección — {item?.sku}</DialogTitle>
                    <DialogDescription>{item?.productName}</DialogDescription>
                </DialogHeader>
                {item?.inspectionPhotos?.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {item.inspectionPhotos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <Image src={url} alt={`Inspección ${i + 1}`} width={200} height={200} className="rounded-md object-cover aspect-square w-full" />
                            </a>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">Sin fotos de inspección aún.</p>
                )}
                {canAddPhotos && (
                    <div className="flex items-end gap-2 pt-2 border-t">
                        <div className="flex-1">
                            <Label htmlFor="gallery-photos">Agregar fotos</Label>
                            <Input id="gallery-photos" ref={fileInputRef} type="file" accept="image/*" multiple className="mt-1" />
                        </div>
                        <Button onClick={handleUpload} disabled={isUploading}>{isUploading ? 'Subiendo…' : 'Subir'}</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
