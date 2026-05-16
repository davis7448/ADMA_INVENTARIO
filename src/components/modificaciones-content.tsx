"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { getModificaciones, createModificacion, updateModificacion, deleteModificacion, getComercialUsers, getPlataformas, getAllModificacionesForExport, type Modificacion, type TipoModificacion } from '@/app/actions/modificaciones';
import { getProducts } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { Download, Loader2, Search, Eye, Pencil, Trash2, Plus, Filter, ClipboardList, BarChart3, ArrowDownUp, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

const PAISES = [
    'Argentina',
    'Chile',
    'Colombia',
    'Ecuador',
    'Guatemala',
    'México',
    'Panamá',
    'Paraguay',
    'Perú',
    'República Dominicana',
    'Uruguay',
].sort();

const TIPOS_MODIFICACION: { value: TipoModificacion; label: string }[] = [
    { value: 'RESERVA_INVENTARIO', label: 'Reserva de Inventario' },
    { value: 'AJUSTE_STOCK', label: 'Ajuste de Stock' },
    { value: 'BAJA_PLATAFORMA', label: 'Baja de Plataforma' },
];

function tipoBadge(tipo?: string) {
    if (tipo === 'RESERVA_INVENTARIO') return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Reserva</Badge>;
    if (tipo === 'BAJA_PLATAFORMA') return <Badge className="bg-red-100 text-red-700 border-red-200">Baja</Badge>;
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Ajuste</Badge>;
}

function estadoBadge(estado?: string) {
    if (estado === 'completado') return <Badge className="bg-green-100 text-green-700 border-green-200">Completado</Badge>;
    if (estado === 'pendiente') return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Pendiente</Badge>;
    return null;
}

function formatFecha(ts?: number | null) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const getPermissionDeniedMessage = (error: unknown, actionLabel: string): string => {
    const rawMessage = error instanceof Error ? error.message : String(error || '');
    const normalizedMessage = rawMessage.toLowerCase();
    if (
        normalizedMessage.includes('no tienes permiso') ||
        normalizedMessage.includes('solo los administradores') ||
        normalizedMessage.includes('permission-denied') ||
        normalizedMessage.includes('missing or insufficient permissions')
    ) {
        return `No tienes permisos para ${actionLabel} en Modificaciones.`;
    }
    return rawMessage || `No se pudo ${actionLabel}. Intenta nuevamente.`;
};

interface ProductOption {
    id: string;
    name: string;
    sku: string | undefined;
}

const EMPTY_FORM: Partial<Modificacion> = {
    FECHA: Date.now(),
    ID: null,
    PRODUCTO: '',
    VARIABLE: '',
    "SKU ": '',
    "PRECIO ": null,
    PLATAFORMA: '',
    BODEGA: '',
    COMERCIAL: '',
    "CODIGO COMERCIAL": '',
    "PRIVADO_PUBLICO": '',
    "CORREO_CODIGO": '',
    CREADO: '',
    SOLICITUD: '',
    "CANTIDAD PREVIA": null,
    "CANTIDAD SOLICITADA": null,
    "CANTIDAD POSTERIOR": null,
    PAIS: '',
    tipoModificacion: 'AJUSTE_STOCK',
    productId: '',
    variantId: '',
    platformId: '',
    customerEmail: '',
};

export function ModificacionesContent() {
    const { user } = useAuth();
    const { toast } = useToast();
    const canCreateOrUpdate = user?.role === 'admin' || user?.role === 'plataformas';
    const canDelete = user?.role === 'admin';

    const [data, setData] = useState<(Modificacion & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string>('');
    const [exporting, setExporting] = useState(false);

    // Filters
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [filterPais, setFilterPais] = useState<string>('todos');
    const [filterComercial, setFilterComercial] = useState<string>('todos');

    // Pagination
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Dialog / Sheet state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<(Modificacion & { id: string }) | null>(null);
    const [detailItem, setDetailItem] = useState<(Modificacion & { id: string }) | null>(null);

    // Form state
    const [formData, setFormData] = useState<Partial<Modificacion>>(EMPTY_FORM);
    const [tipoModificacion, setTipoModificacion] = useState<TipoModificacion>('AJUSTE_STOCK');
    const [formError, setFormError] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    // Lookups
    const [comercialUsers, setComercialUsers] = useState<{ name: string; code: string }[]>([]);
    const [plataformas, setPlataformas] = useState<string[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);

    const fetchData = async (start?: Date, end?: Date) => {
        setLoading(true);
        setFetchError('');
        try {
            const result = await getModificaciones(start, end, filterPais, filterComercial);
            setData(result);
            setCurrentPage(1);
        } catch (error) {
            console.error('Error fetching modificaciones:', error);
            setFetchError(error instanceof Error ? error.message : 'Error al cargar los datos.');
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async (search: string = '') => {
        try {
            const result = await getProducts({ page: 1, limit: 50, fetchAll: true, filters: search ? { search } : {} });
            setProducts(result.products.map(p => ({ id: p.id, name: p.name, sku: p.sku })));
        } catch {
            setProducts([]);
        }
    };

    useEffect(() => {
        fetchData();
        getComercialUsers().then(setComercialUsers).catch(() => setComercialUsers([]));
        getPlataformas().then(setPlataformas).catch(() => setPlataformas([]));
        fetchProducts();
    }, []);

    const handleFilter = () => {
        fetchData(startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
    };

    const handleClearFilters = () => {
        setStartDate('');
        setEndDate('');
        setFilterPais('todos');
        setFilterComercial('todos');
        fetchData();
    };

    // Pagination
    const totalRecords = data.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const paginatedData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Stats
    const countTipo = (tipo: TipoModificacion) => data.filter(d => d.tipoModificacion === tipo).length;
    const countAjuste = data.filter(d => !d.tipoModificacion || d.tipoModificacion === 'AJUSTE_STOCK').length;
    const countBajas = data.filter(d => d["CANTIDAD POSTERIOR"] === 0).length;

    // Form handlers
    const handleFormChange = (field: keyof Modificacion, value: any) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'CANTIDAD PREVIA' || field === 'CANTIDAD SOLICITADA') {
                const previa = field === 'CANTIDAD PREVIA' ? Number(value) : Number(prev['CANTIDAD PREVIA'] || 0);
                const solicitada = field === 'CANTIDAD SOLICITADA' ? Number(value) : Number(prev['CANTIDAD SOLICITADA'] || 0);
                next['CANTIDAD POSTERIOR'] = previa + solicitada;
            }
            return next;
        });
    };

    const handleTipoChange = (value: TipoModificacion) => {
        setTipoModificacion(value);
        setFormData(prev => ({ ...prev, tipoModificacion: value }));
    };

    const handleProductSearch = (value: string) => {
        setProductSearch(value);
        if (value.length >= 2) {
            fetchProducts(value);
            setShowProductDropdown(true);
        } else {
            setShowProductDropdown(false);
        }
    };

    const handleSelectProduct = (product: ProductOption) => {
        setFormData(prev => ({ ...prev, productId: product.id, PRODUCTO: product.name }));
        setProductSearch(product.name);
        setShowProductDropdown(false);
    };

    const resetForm = () => {
        setFormData(EMPTY_FORM);
        setTipoModificacion('AJUSTE_STOCK');
        setProductSearch('');
        setFormError('');
    };

    const openCreateDialog = () => {
        setEditingItem(null);
        resetForm();
        setDialogOpen(true);
    };

    const openEditDialog = (item: Modificacion & { id: string }) => {
        setEditingItem(item);
        const tipo = item.tipoModificacion || 'AJUSTE_STOCK';
        setTipoModificacion(tipo);
        setFormData({
            FECHA: item.FECHA,
            ID: item.ID,
            PRODUCTO: item.PRODUCTO || '',
            VARIABLE: item.VARIABLE || '',
            "SKU ": item["SKU "] || '',
            "PRECIO ": item["PRECIO "] || null,
            PLATAFORMA: item.PLATAFORMA || '',
            BODEGA: item.BODEGA || '',
            COMERCIAL: item.COMERCIAL || '',
            "CODIGO COMERCIAL": item["CODIGO COMERCIAL"] || '',
            "PRIVADO_PUBLICO": item["PRIVADO_PUBLICO"] || '',
            "CORREO_CODIGO": item["CORREO_CODIGO"] || '',
            CREADO: item.CREADO || '',
            SOLICITUD: item.SOLICITUD || '',
            "CANTIDAD PREVIA": item["CANTIDAD PREVIA"] || null,
            "CANTIDAD SOLICITADA": item["CANTIDAD SOLICITADA"] || null,
            "CANTIDAD POSTERIOR": (Number(item["CANTIDAD PREVIA"] || 0) + Number(item["CANTIDAD SOLICITADA"] || 0)) || null,
            PAIS: item.PAIS || '',
            tipoModificacion: tipo,
            productId: item.productId || '',
            variantId: item.variantId || '',
            platformId: item.platformId || '',
            customerEmail: item.customerEmail || '',
        });
        setProductSearch(item.PRODUCTO || '');
        setFormError('');
        setDialogOpen(true);
    };

    const openDetailSheet = (item: Modificacion & { id: string }) => {
        setDetailItem(item);
        setSheetOpen(true);
    };

    const handleCreate = async () => {
        setFormError('');
        if (!formData.PAIS?.trim()) { setFormError('El campo PAÍS es obligatorio'); return; }
        if (tipoModificacion === 'RESERVA_INVENTARIO') {
            if (!formData.productId) { setFormError('Debe seleccionar un producto para la reserva'); return; }
            if (!formData.platformId) { setFormError('Debe seleccionar una plataforma para la reserva'); return; }
            if (!formData.customerEmail && !formData['CORREO_CODIGO']) { setFormError('Debe ingresar el correo del cliente'); return; }
            if (!formData["CANTIDAD SOLICITADA"] || formData["CANTIDAD SOLICITADA"] <= 0) { setFormError('Cantidad inválida'); return; }
            if (!formData["CODIGO COMERCIAL"]) { setFormError('Debe seleccionar un comercial'); return; }
        }
        setSubmitting(true);
        try {
            const variables = formData.VARIABLE ? formData.VARIABLE.split(',').map(v => v.trim()) : [''];
            const emails = formData["CORREO_CODIGO"] ? formData["CORREO_CODIGO"].split(',').map(e => e.trim()) : [''];
            for (const variable of variables) {
                const [varName, sku] = variable.includes(':') ? variable.split(':') : [variable, formData["SKU "] || ''];
                for (const email of emails) {
                    await createModificacion({ ...formData, VARIABLE: varName, "SKU ": sku, "CORREO_CODIGO": email, tipoModificacion } as Omit<Modificacion, 'ID CONSECUTIVO'>);
                }
            }
            setDialogOpen(false);
            resetForm();
            fetchData();
            toast({ title: 'Modificación creada', description: 'El registro fue guardado correctamente.' });
        } catch (error) {
            setFormError(getPermissionDeniedMessage(error, 'crear modificaciones'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = async () => {
        if (!editingItem) return;
        setSubmitting(true);
        try {
            await updateModificacion(editingItem.id, formData);
            setDialogOpen(false);
            setEditingItem(null);
            resetForm();
            fetchData();
            toast({ title: 'Modificación actualizada' });
        } catch (error) {
            setFormError(getPermissionDeniedMessage(error, 'editar modificaciones'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta modificación?')) return;
        try {
            await deleteModificacion(id);
            fetchData();
            toast({ title: 'Eliminado', description: 'La modificación fue eliminada.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Permiso denegado', description: getPermissionDeniedMessage(error, 'eliminar modificaciones') });
        }
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const allData = await getAllModificacionesForExport(
                startDate ? new Date(startDate) : undefined,
                endDate ? new Date(endDate) : undefined,
                filterPais, filterComercial
            );
            if (allData.length === 0) { toast({ title: 'Sin datos para exportar' }); return; }
            const excelData = allData.map(row => ({
                'Fecha': row.FECHA ? new Date(row.FECHA).toLocaleDateString() : '',
                'ID': row.ID || '',
                'Tipo': row.tipoModificacion || '',
                'Producto': row.PRODUCTO || '',
                'Variable': row.VARIABLE || '',
                'SKU': row["SKU "] || '',
                'Precio': row["PRECIO "] || '',
                'Plataforma': row.PLATAFORMA || '',
                'Bodega': row.BODEGA || '',
                'Comercial': row.COMERCIAL || '',
                'Código Comercial': row["CODIGO COMERCIAL"] || '',
                'Privado/Público': row["PRIVADO_PUBLICO"] || '',
                'Correo/Código': row["CORREO_CODIGO"] || '',
                'Creado': row.CREADO || '',
                'Solicitud': row.SOLICITUD || '',
                'Cantidad Previa': row["CANTIDAD PREVIA"] || '',
                'Cantidad Solicitada': row["CANTIDAD SOLICITADA"] || '',
                'Cantidad Posterior': row["CANTIDAD POSTERIOR"] || '',
                'ID Consecutivo': row["ID CONSECUTIVO"] || '',
                'País': row.PAIS || '',
                'ID Reserva': row.reservationId || '',
                'Estado': row.estadoSolicitud || '',
            }));
            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Modificaciones');
            XLSX.writeFile(wb, `modificaciones_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch {
            toast({ variant: 'destructive', title: 'Error al exportar' });
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Modificaciones</h1>
                    <p className="text-muted-foreground text-sm mt-1">Histórico de movimientos del segundo semestre de 2025.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" onClick={handleExportExcel} disabled={exporting}>
                        {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Exportar
                    </Button>
                    {canCreateOrUpdate && (
                        <Button onClick={openCreateDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Modificación
                        </Button>
                    )}
                </div>
            </div>

            {/* Error banner */}
            {fetchError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span><strong>Error al cargar:</strong> {fetchError}</span>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                            <ClipboardList className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="text-2xl font-bold">{totalRecords}</p>
                                <p className="text-xs text-muted-foreground">Total registros</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                            <BarChart3 className="h-8 w-8 text-blue-500" />
                            <div>
                                <p className="text-2xl font-bold">{countAjuste}</p>
                                <p className="text-xs text-muted-foreground">Ajustes</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                            <ArrowDownUp className="h-8 w-8 text-orange-500" />
                            <div>
                                <p className="text-2xl font-bold">{countTipo('RESERVA_INVENTARIO')}</p>
                                <p className="text-xs text-muted-foreground">Reservas</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                            <XCircle className="h-8 w-8 text-red-500" />
                            <div>
                                <p className="text-2xl font-bold">{countBajas}</p>
                                <p className="text-xs text-muted-foreground">Bajas (cant. en 0)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" /> Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                        <div>
                            <Label className="text-xs">Fecha inicio</Label>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
                        </div>
                        <div>
                            <Label className="text-xs">Fecha fin</Label>
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" />
                        </div>
                        <div>
                            <Label className="text-xs">País</Label>
                            <Select value={filterPais} onValueChange={setFilterPais}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    {PAISES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Comercial</Label>
                            <Select value={filterComercial} onValueChange={setFilterComercial}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    {comercialUsers.map(u => <SelectItem key={u.code} value={u.code}>{u.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleFilter} className="flex-1 h-9">Filtrar</Button>
                            <Button variant="ghost" onClick={handleClearFilters} className="h-9 px-2" title="Limpiar filtros">
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent className="pt-4">
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="h-9 w-24" />
                                    <Skeleton className="h-9 w-20" />
                                    <Skeleton className="h-9 flex-1" />
                                    <Skeleton className="h-9 w-24" />
                                    <Skeleton className="h-9 w-24" />
                                    <Skeleton className="h-9 w-20" />
                                </div>
                            ))}
                        </div>
                    ) : paginatedData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <ClipboardList className="h-12 w-12 mb-3 opacity-30" />
                            <p className="text-sm font-medium">Sin registros en el período seleccionado</p>
                            <p className="text-xs mt-1">Ajusta los filtros o crea una nueva modificación.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm text-muted-foreground">
                                    Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalRecords)} de <strong>{totalRecords}</strong>
                                </p>
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs">Por página:</Label>
                                    <Select value={pageSize.toString()} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
                                        <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {[20, 50, 100, 200, 500].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-16">ID</TableHead>
                                            <TableHead className="w-28">Fecha</TableHead>
                                            <TableHead className="w-24">Tipo</TableHead>
                                            <TableHead>Producto / Variable</TableHead>
                                            <TableHead className="w-28">País</TableHead>
                                            <TableHead className="w-32">Plataforma</TableHead>
                                            <TableHead className="w-28">Comercial</TableHead>
                                            <TableHead className="w-36 text-center">Cantidades</TableHead>
                                            <TableHead className="w-24">Estado</TableHead>
                                            <TableHead className="w-28 text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedData.map(row => (
                                            <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="text-sm font-medium tabular-nums">{row.ID ?? '—'}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatFecha(row.FECHA)}</TableCell>
                                                <TableCell>{tipoBadge(row.tipoModificacion)}</TableCell>
                                                <TableCell>
                                                    <p className="font-medium text-sm leading-tight">{row.PRODUCTO || '—'}</p>
                                                    {row.VARIABLE && <p className="text-xs text-muted-foreground mt-0.5">{row.VARIABLE}</p>}
                                                </TableCell>
                                                <TableCell className="text-sm">{row.PAIS || '—'}</TableCell>
                                                <TableCell className="text-sm truncate max-w-[120px]">{row.PLATAFORMA || '—'}</TableCell>
                                                <TableCell className="text-sm">{row["CODIGO COMERCIAL"] || row.COMERCIAL || '—'}</TableCell>
                                                <TableCell className="text-center">
                                                    <span className="text-xs text-muted-foreground">{row["CANTIDAD PREVIA"] ?? '—'}</span>
                                                    <span className="text-xs mx-1">→</span>
                                                    <span className="font-semibold text-sm">{row["CANTIDAD SOLICITADA"] ?? '—'}</span>
                                                    <span className="text-xs mx-1">→</span>
                                                    <span className="text-xs text-muted-foreground">{row["CANTIDAD POSTERIOR"] ?? '—'}</span>
                                                </TableCell>
                                                <TableCell>{estadoBadge(row.estadoSolicitud) ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDetailSheet(row)} title="Ver detalle">
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {canCreateOrUpdate && (
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(row)} title="Editar">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {canDelete && (
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(row.id)} title="Eliminar">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-center gap-3 mt-4">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>«</Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button>
                                <span className="text-sm font-medium px-2">Página {currentPage} de {totalPages}</span>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Siguiente</Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>»</Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            {detailItem && tipoBadge(detailItem.tipoModificacion)}
                            Detalle de Modificación
                        </SheetTitle>
                    </SheetHeader>
                    {detailItem && (
                        <div className="mt-6 space-y-4">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <DetailRow label="Fecha" value={formatFecha(detailItem.FECHA)} />
                                <DetailRow label="ID Consecutivo" value={String(detailItem["ID CONSECUTIVO"] ?? '—')} />
                                <DetailRow label="ID" value={String(detailItem.ID ?? '—')} />
                                <DetailRow label="País" value={detailItem.PAIS || '—'} />
                            </div>
                            <Separator />
                            <div className="space-y-2 text-sm">
                                <DetailRow label="Producto" value={detailItem.PRODUCTO || '—'} />
                                <DetailRow label="Variable" value={detailItem.VARIABLE || '—'} />
                                <DetailRow label="SKU" value={String(detailItem["SKU "] || '—')} />
                                <DetailRow label="Precio" value={detailItem["PRECIO "] ? `$${detailItem["PRECIO "]}` : '—'} />
                            </div>
                            <Separator />
                            <div className="space-y-2 text-sm">
                                <DetailRow label="Plataforma" value={detailItem.PLATAFORMA || '—'} />
                                <DetailRow label="Bodega" value={detailItem.BODEGA || '—'} />
                                <DetailRow label="Comercial" value={detailItem.COMERCIAL || '—'} />
                                <DetailRow label="Código Comercial" value={detailItem["CODIGO COMERCIAL"] || '—'} />
                                <DetailRow label="Privado/Público" value={detailItem["PRIVADO_PUBLICO"] || '—'} />
                                <DetailRow label="Correo/Código" value={detailItem["CORREO_CODIGO"] || '—'} />
                            </div>
                            <Separator />
                            <div className="space-y-2 text-sm">
                                <p className="font-medium text-muted-foreground uppercase text-xs tracking-wider">Cantidades</p>
                                <div className="flex items-center gap-4 bg-muted/40 rounded-lg p-3">
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground">Previa</p>
                                        <p className="text-lg font-semibold">{detailItem["CANTIDAD PREVIA"] ?? '—'}</p>
                                    </div>
                                    <span className="text-muted-foreground">→</span>
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground">Solicitada</p>
                                        <p className="text-lg font-bold text-primary">{detailItem["CANTIDAD SOLICITADA"] ?? '—'}</p>
                                    </div>
                                    <span className="text-muted-foreground">→</span>
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground">Posterior</p>
                                        <p className="text-lg font-semibold">{detailItem["CANTIDAD POSTERIOR"] ?? '—'}</p>
                                    </div>
                                </div>
                                <DetailRow label="Creado" value={detailItem.CREADO || '—'} />
                                <DetailRow label="Solicitud" value={detailItem.SOLICITUD || '—'} />
                            </div>
                            {(detailItem.tipoModificacion === 'RESERVA_INVENTARIO' || detailItem.reservationId) && (
                                <>
                                    <Separator />
                                    <div className="space-y-2 text-sm">
                                        <p className="font-medium text-muted-foreground uppercase text-xs tracking-wider">Reserva</p>
                                        <DetailRow label="ID Reserva" value={detailItem.reservationId || '—'} />
                                        <DetailRow label="Estado" value={detailItem.estadoSolicitud || '—'} />
                                        <DetailRow label="Correo cliente" value={detailItem.customerEmail || '—'} />
                                    </div>
                                </>
                            )}
                            {canCreateOrUpdate && (
                                <div className="pt-2 flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={() => { setSheetOpen(false); openEditDialog(detailItem); }}>
                                        <Pencil className="mr-2 h-4 w-4" /> Editar
                                    </Button>
                                    {canDelete && (
                                        <Button variant="destructive" onClick={() => { setSheetOpen(false); handleDelete(detailItem.id); }}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) { setEditingItem(null); resetForm(); } }}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Editar Modificación' : 'Nueva Modificación'}</DialogTitle>
                    </DialogHeader>

                    {formError && (
                        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm">
                            {formError}
                        </div>
                    )}

                    {/* Tipo */}
                    <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo de modificación</Label>
                        <div className="flex flex-wrap gap-3 mt-2">
                            {TIPOS_MODIFICACION.map(t => (
                                <label key={t.value} className={`flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors ${tipoModificacion === t.value ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-muted-foreground'}`}>
                                    <input type="radio" name="tipoModificacion" value={t.value} checked={tipoModificacion === t.value} onChange={() => handleTipoChange(t.value)} className="sr-only" />
                                    {t.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Product search for reservas */}
                    {tipoModificacion === 'RESERVA_INVENTARIO' && (
                        <div>
                            <Label className="text-xs">Producto <span className="text-destructive">*</span></Label>
                            <div className="relative mt-1">
                                <Input value={productSearch} onChange={e => handleProductSearch(e.target.value)} onFocus={() => { if (productSearch.length >= 2) setShowProductDropdown(true); }} placeholder="Buscar por nombre o SKU..." />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                {showProductDropdown && products.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                                        {products.map(p => (
                                            <div key={p.id} className="px-3 py-2 cursor-pointer hover:bg-muted text-sm" onClick={() => handleSelectProduct(p)}>
                                                <p className="font-medium">{p.name}</p>
                                                <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-xs">ID</Label>
                            <Input type="number" value={formData.ID || ''} onChange={e => handleFormChange('ID', Number(e.target.value))} className="mt-1" />
                        </div>

                        {tipoModificacion !== 'RESERVA_INVENTARIO' && (
                            <div>
                                <Label className="text-xs">Producto</Label>
                                <Input value={formData.PRODUCTO || ''} onChange={e => handleFormChange('PRODUCTO', e.target.value)} className="mt-1" />
                            </div>
                        )}

                        <div className="col-span-2">
                            <Label className="text-xs">Variable <span className="text-muted-foreground">(Nombre:SKU separados por coma)</span></Label>
                            <Textarea value={formData.VARIABLE || ''} onChange={e => handleFormChange('VARIABLE', e.target.value)} placeholder="X1 UNIDAD:123, X2 UNIDADES:456" className="mt-1 resize-none h-16" />
                        </div>

                        <div>
                            <Label className="text-xs">SKU</Label>
                            <Input value={formData["SKU "] || ''} onChange={e => handleFormChange('SKU ', e.target.value)} className="mt-1" />
                        </div>

                        <div>
                            <Label className="text-xs">Precio</Label>
                            <Input type="number" value={formData["PRECIO "] || ''} onChange={e => handleFormChange('PRECIO ', Number(e.target.value))} className="mt-1" />
                        </div>

                        <div>
                            <Label className="text-xs">Plataforma</Label>
                            <Select value={formData.PLATAFORMA || ''} onValueChange={v => handleFormChange('PLATAFORMA', v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                                <SelectContent>{plataformas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs">Bodega</Label>
                            <Select value={formData.BODEGA || ''} onValueChange={v => handleFormChange('BODEGA', v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INGENIO">INGENIO</SelectItem>
                                    <SelectItem value="LABORATORIO">LABORATORIO</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs">Comercial</Label>
                            <Select value={formData.COMERCIAL || ''} onValueChange={v => {
                                const u = comercialUsers.find(u => u.name === v);
                                if (u) { handleFormChange('COMERCIAL', u.name); handleFormChange('CODIGO COMERCIAL', u.code); }
                            }}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                                <SelectContent>{comercialUsers.map(u => <SelectItem key={u.name} value={u.name}>{u.name} ({u.code})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs">Código Comercial</Label>
                            <Input value={formData["CODIGO COMERCIAL"] || ''} onChange={e => handleFormChange('CODIGO COMERCIAL', e.target.value)} className="mt-1" />
                        </div>

                        {tipoModificacion === 'RESERVA_INVENTARIO' && (
                            <>
                                <div>
                                    <Label className="text-xs">Plataforma de venta <span className="text-destructive">*</span></Label>
                                    <Select value={formData.platformId || ''} onValueChange={v => handleFormChange('platformId', v)}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                                        <SelectContent>{plataformas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-xs">Correo del cliente <span className="text-destructive">*</span></Label>
                                    <Input type="email" value={formData.customerEmail || ''} onChange={e => handleFormChange('customerEmail', e.target.value)} placeholder="cliente@ejemplo.com" className="mt-1" />
                                </div>
                                <div>
                                    <Label className="text-xs">Variante (opcional)</Label>
                                    <Input value={formData.variantId || ''} onChange={e => handleFormChange('variantId', e.target.value)} placeholder="ID de variante" className="mt-1" />
                                </div>
                            </>
                        )}

                        <div>
                            <Label className="text-xs">Privado / Público</Label>
                            <Select value={formData["PRIVADO_PUBLICO"] || ''} onValueChange={v => handleFormChange('PRIVADO_PUBLICO', v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Publico">Público</SelectItem>
                                    <SelectItem value="Privado">Privado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-2">
                            <Label className="text-xs">Correo/Código <span className="text-muted-foreground">(separados por coma)</span></Label>
                            <Textarea value={formData["CORREO_CODIGO"] || ''} onChange={e => handleFormChange('CORREO_CODIGO', e.target.value)} placeholder="email1@example.com, email2@example.com" className="mt-1 resize-none h-16" />
                        </div>

                        <div>
                            <Label className="text-xs">Creado</Label>
                            <Select value={formData.CREADO || ''} onValueChange={v => handleFormChange('CREADO', v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SI">SI</SelectItem>
                                    <SelectItem value="NO">NO</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs">Solicitud</Label>
                            <Select value={formData.SOLICITUD || ''} onValueChange={v => handleFormChange('SOLICITUD', v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SUMA">SUMA</SelectItem>
                                    <SelectItem value="AJUSTE">AJUSTE</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-xs">Cantidad previa</Label>
                            <Input type="number" value={formData["CANTIDAD PREVIA"] ?? ''} onChange={e => handleFormChange('CANTIDAD PREVIA', Number(e.target.value))} className="mt-1" />
                        </div>

                        <div>
                            <Label className="text-xs">Cantidad solicitada</Label>
                            <Input type="number" value={formData["CANTIDAD SOLICITADA"] ?? ''} onChange={e => handleFormChange('CANTIDAD SOLICITADA', Number(e.target.value))} className="mt-1" />
                        </div>

                        <div>
                            <Label className="text-xs">Cantidad posterior <span className="text-muted-foreground">(calculada)</span></Label>
                            <Input type="number" value={formData["CANTIDAD POSTERIOR"] ?? ''} disabled className="mt-1 bg-muted" />
                        </div>

                        <div>
                            <Label className="text-xs">País <span className="text-destructive">*</span></Label>
                            <Select value={formData.PAIS || ''} onValueChange={v => handleFormChange('PAIS', v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                                <SelectContent>{PAISES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={editingItem ? handleEdit : handleCreate} disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingItem ? 'Actualizar' : 'Crear'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-2">
            <span className="text-muted-foreground shrink-0">{label}</span>
            <span className="font-medium text-right">{value}</span>
        </div>
    );
}
