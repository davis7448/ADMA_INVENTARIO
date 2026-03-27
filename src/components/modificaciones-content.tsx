"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getModificaciones, createModificacion, updateModificacion, deleteModificacion, getComercialUsers, getPlataformas, getAllModificacionesForExport, type Modificacion, type TipoModificacion } from '@/app/actions/modificaciones';
import { getProducts } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { Download, Loader2, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

const PAISES = [
    'Argentina',
    'Chile', 
    'Colombia',
    'Ecuador',
    'México',
    'Panamá',
    'Paraguay',
    'Perú',
    'República Dominicana',
    'Uruguay'
].sort();

const TIPOS_MODIFICACION: { value: TipoModificacion; label: string }[] = [
    { value: 'RESERVA_INVENTARIO', label: 'Reserva de Inventario' },
    { value: 'AJUSTE_STOCK', label: 'Ajuste de Stock' },
    { value: 'BAJA_PLATAFORMA', label: 'Baja de Plataforma' },
];

const ROLE_ALIASES: Record<string, string> = {
    plataforma: 'plataformas',
    plataformas: 'plataformas',
    platform: 'plataformas',
    platforms: 'plataformas',
    administrador: 'admin',
    admin: 'admin',
};

const normalizeRole = (role?: string | null): string => {
    if (!role) return '';
    const sanitizedRole = role
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim();

    return ROLE_ALIASES[sanitizedRole] ?? sanitizedRole;
};

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

export function ModificacionesContent() {
    const { user } = useAuth();
    const { toast } = useToast();
    const normalizedUserRole = normalizeRole(user?.role);
    const canCreateOrUpdate = normalizedUserRole === 'admin' || normalizedUserRole === 'plataformas';
    const canDelete = normalizedUserRole === 'admin';

    const [data, setData] = useState<(Modificacion & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [filterPais, setFilterPais] = useState<string>('todos');
    const [filterComercial, setFilterComercial] = useState<string>('todos');
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<(Modificacion & { id: string }) | null>(null);
    const [comercialUsers, setComercialUsers] = useState<{ name: string; code: string }[]>([]);
    const [plataformas, setPlataformas] = useState<string[]>([]);
    const [formError, setFormError] = useState<string>('');
    
    // Estados para el selector de productos
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    
    // Estado para el tipo de modificación
    const [tipoModificacion, setTipoModificacion] = useState<TipoModificacion>('AJUSTE_STOCK');

    const [formData, setFormData] = useState<Partial<Modificacion>>({
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
        // Nuevos campos para reservas
        tipoModificacion: 'AJUSTE_STOCK',
        productId: '',
        variantId: '',
        platformId: '',
        customerEmail: '',
    });

    const fetchData = async (start?: Date, end?: Date) => {
        setLoading(true);
        try {
            const result = await getModificaciones(start, end, filterPais, filterComercial);
            setData(result);
            setCurrentPage(1);
        } catch (error) {
            console.error('Error fetching modificaciones:', error);
        } finally {
            setLoading(false);
        }
    };

    // Función para cargar productos
    const fetchProducts = async (search: string = '') => {
        try {
            const result = await getProducts({ page: 1, limit: 50, fetchAll: true, filters: search ? { search } : {} });
            const productOptions: ProductOption[] = result.products.map(p => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
            }));
            setProducts(productOptions);
        } catch (error) {
            console.error('Error fetching products:', error);
            setProducts([]);
        }
    };

    useEffect(() => {
        fetchData();
        const fetchComercialUsers = async () => {
            try {
                const users = await getComercialUsers();
                setComercialUsers(users);
            } catch (error) {
                console.error('Error fetching comercial users:', error);
                setComercialUsers([{ name: 'Camilo Useche', code: 'CU' }]);
            }
        };
        const fetchPlataformas = async () => {
            try {
                const plats = await getPlataformas();
                setPlataformas(plats);
            } catch (error) {
                console.error('Error fetching plataformas:', error);
                setPlataformas([]);
            }
        };
        fetchComercialUsers();
        fetchPlataformas();
        // Cargar productos inicialmente
        fetchProducts();
    }, []);

    const handleFilter = () => {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        fetchData(start, end);
    };

    const totalRecords = data.length;
    const totalPages = Math.ceil(totalRecords / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = data.slice(startIndex, endIndex);

    const handlePageSizeChange = (value: string) => {
        setPageSize(Number(value));
        setCurrentPage(1);
    };

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    const handleFormChange = (field: keyof Modificacion, value: any) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };
            if (field === 'CANTIDAD PREVIA' || field === 'CANTIDAD SOLICITADA') {
                const previa = field === 'CANTIDAD PREVIA' ? Number(value) : Number(prev['CANTIDAD PREVIA'] || 0);
                const solicitada = field === 'CANTIDAD SOLICITADA' ? Number(value) : Number(prev['CANTIDAD SOLICITADA'] || 0);
                newData['CANTIDAD POSTERIOR'] = previa + solicitada;
            }
            return newData;
        });
    };

    // Manejar cambio de tipo de modificación
    const handleTipoModificacionChange = (value: TipoModificacion) => {
        setTipoModificacion(value);
        setFormData(prev => ({
            ...prev,
            tipoModificacion: value,
        }));
    };

    // Manejar búsqueda de productos
    const handleProductSearch = (value: string) => {
        setProductSearch(value);
        if (value.length >= 2) {
            fetchProducts(value);
            setShowProductDropdown(true);
        } else {
            setShowProductDropdown(false);
        }
    };

    // Seleccionar producto
    const handleSelectProduct = (product: ProductOption) => {
        setFormData(prev => ({
            ...prev,
            productId: product.id,
            PRODUCTO: product.name,
        }));
        setProductSearch(product.name);
        setShowProductDropdown(false);
    };

    const handleCreate = async () => {
        setFormError('');
        
        // Validar país obligatorio
        if (!formData.PAIS || formData.PAIS.trim() === '') {
            setFormError('El campo PAÍS es obligatorio');
            return;
        }

        // Validaciones específicas para reservas de inventario
        if (tipoModificacion === 'RESERVA_INVENTARIO') {
            if (!formData.productId) {
                setFormError('Debe seleccionar un producto para crear una reserva de inventario');
                return;
            }
            if (!formData.platformId) {
                setFormError('Debe seleccionar una plataforma para crear una reserva de inventario');
                return;
            }
            if (!formData.customerEmail && !formData['CORREO_CODIGO']) {
                setFormError('Debe ingresar el correo del cliente para crear una reserva de inventario');
                return;
            }
            if (!formData["CANTIDAD SOLICITADA"] || formData["CANTIDAD SOLICITADA"] <= 0) {
                setFormError('Debe ingresar una cantidad válida para crear una reserva de inventario');
                return;
            }
            if (!formData["CODIGO COMERCIAL"]) {
                setFormError('Debe seleccionar un comercial (vendedor) para crear una reserva de inventario');
                return;
            }
        }

        try {
            const variables = formData.VARIABLE ? formData.VARIABLE.split(',').map(v => v.trim()) : [''];
            const emails = formData["CORREO_CODIGO"] ? formData["CORREO_CODIGO"].split(',').map(e => e.trim()) : [''];

            for (const variable of variables) {
                const [varName, sku] = variable.includes(':') ? variable.split(':') : [variable, formData["SKU "] || ''];
                for (const email of emails) {
                    const record = {
                        ...formData,
                        VARIABLE: varName,
                        "SKU ": sku,
                        "CORREO_CODIGO": email,
                        tipoModificacion: tipoModificacion,
                    };
                    await createModificacion(record as Omit<Modificacion, 'ID CONSECUTIVO'>);
                }
            }

            setDialogOpen(false);
            resetForm();
            fetchData();
        } catch (error) {
            console.error('Error creating modificacion:', error);
            setFormError(getPermissionDeniedMessage(error, 'crear modificaciones'));
        }
    };

    const handleEdit = async () => {
        if (!editingItem) return;

        try {
            await updateModificacion(editingItem.id, formData);
            setDialogOpen(false);
            setEditingItem(null);
            resetForm();
            fetchData();
        } catch (error) {
            console.error('Error updating modificacion:', error);
            setFormError(getPermissionDeniedMessage(error, 'editar modificaciones'));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta modificación?')) return;

        try {
            await deleteModificacion(id);
            fetchData();
        } catch (error) {
            console.error('Error deleting modificacion:', error);
            toast({
                variant: 'destructive',
                title: 'Permiso denegado',
                description: getPermissionDeniedMessage(error, 'eliminar modificaciones'),
            });
        }
    };

    const resetForm = () => {
        setFormData({
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
        });
        setTipoModificacion('AJUSTE_STOCK');
        setProductSearch('');
        setFormError('');
    };

    const openEditDialog = (item: Modificacion & { id: string }) => {
        setEditingItem(item);
        const itemTipoModificacion = item.tipoModificacion || 'AJUSTE_STOCK';
        setTipoModificacion(itemTipoModificacion);
        
        const newFormData = {
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
            "CANTIDAD POSTERIOR": item["CANTIDAD POSTERIOR"] || null,
            PAIS: item.PAIS || '',
            // Nuevos campos
            tipoModificacion: itemTipoModificacion,
            productId: item.productId || '',
            variantId: item.variantId || '',
            platformId: item.platformId || '',
            customerEmail: item.customerEmail || '',
        };
        const previa = Number(newFormData["CANTIDAD PREVIA"] || 0);
        const solicitada = Number(newFormData["CANTIDAD SOLICITADA"] || 0);
        newFormData["CANTIDAD POSTERIOR"] = previa + solicitada;
        setFormData(newFormData);
        
        // Si tiene productId, buscar el nombre del producto
        if (item.productId && !item.PRODUCTO) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                setProductSearch(product.name);
            }
        } else {
            setProductSearch(item.PRODUCTO || '');
        }
        
        setDialogOpen(true);
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const start = startDate ? new Date(startDate) : undefined;
            const end = endDate ? new Date(endDate) : undefined;
            
            // Obtener todos los datos (sin paginación)
            const allData = await getAllModificacionesForExport(start, end, filterPais, filterComercial);
            
            if (allData.length === 0) {
                alert('No hay datos para exportar');
                setExporting(false);
                return;
            }

            // Preparar datos para Excel
            const excelData = allData.map(row => ({
                'Fecha': row.FECHA ? new Date(row.FECHA).toLocaleDateString() : '',
                'ID': row.ID || '',
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
                'Tipo Modificación': row.tipoModificacion || '',
                'ID Reserva': row.reservationId || '',
                'Estado Solicitud': row.estadoSolicitud || '',
            }));

            // Crear workbook
            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Modificaciones');
            
            // Generar nombre de archivo
            const fileName = `modificaciones_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            // Descargar
            XLSX.writeFile(wb, fileName);
            
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Error al exportar a Excel');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Modificaciones</h1>
                <p className="text-muted-foreground">Histórico de movimientos del segundo semestre de 2025.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Tabla de Modificaciones</CardTitle>
                    <div className="flex flex-wrap gap-4 items-end justify-between">
                        <div className="flex gap-4 items-end flex-wrap">
                            <div>
                                <Label htmlFor="start-date">Fecha Inicio</Label>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label htmlFor="end-date">Fecha Fin</Label>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>País</Label>
                                <Select value={filterPais} onValueChange={setFilterPais}>
                                    <SelectTrigger className="w-44">
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
                                        {PAISES.map(pais => (
                                            <SelectItem key={pais} value={pais}>{pais}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Comercial</Label>
                                <Select value={filterComercial} onValueChange={setFilterComercial}>
                                    <SelectTrigger className="w-48">
                                        <SelectValue placeholder="Todos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
                                        {comercialUsers.map(user => (
                                            <SelectItem key={user.code} value={user.code}>{user.name} ({user.code})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleFilter}>Filtrar</Button>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                onClick={handleExportExcel}
                                disabled={exporting}
                            >
                                {exporting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                Exportar Excel
                            </Button>
                            {canCreateOrUpdate && (
                                <Dialog open={dialogOpen} onOpenChange={(open) => {
                                    setDialogOpen(open);
                                    if (!open) {
                                        setEditingItem(null);
                                        resetForm();
                                    }
                                }}>
                                    <DialogTrigger asChild>
                                        <Button>Crear Nueva Modificación</Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>{editingItem ? 'Editar Modificación' : 'Crear Nueva Modificación'}</DialogTitle>
                                        </DialogHeader>
                                        {formError && (
                                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                                                {formError}
                                            </div>
                                        )}
                                        
                                        {/* Selector de Tipo de Modificación */}
                                        <div className="mb-6">
                                            <Label>Tipo de Modificación</Label>
                                            <div className="flex gap-4 mt-2">
                                                {TIPOS_MODIFICACION.map((tipo) => (
                                                    <label key={tipo.value} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="tipoModificacion"
                                                            value={tipo.value}
                                                            checked={tipoModificacion === tipo.value}
                                                            onChange={() => handleTipoModificacionChange(tipo.value)}
                                                            className="w-4 h-4"
                                                        />
                                                        <span>{tipo.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Selector de Producto - Solo para RESERVA_INVENTARIO */}
                                        {tipoModificacion === 'RESERVA_INVENTARIO' && (
                                            <div className="mb-4">
                                                <Label>Producto * (Requerido para reservas)</Label>
                                                <div className="relative">
                                                    <Input
                                                        value={productSearch}
                                                        onChange={(e) => handleProductSearch(e.target.value)}
                                                        onFocus={() => {
                                                            if (productSearch.length >= 2) {
                                                                setShowProductDropdown(true);
                                                            }
                                                        }}
                                                        placeholder="Buscar producto por nombre o SKU..."
                                                    />
                                                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    {showProductDropdown && products.length > 0 && (
                                                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                                                            {products.map((product) => (
                                                                <div
                                                                    key={product.id}
                                                                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                                                    onClick={() => handleSelectProduct(product)}
                                                                >
                                                                    <div className="font-medium">{product.name}</div>
                                                                    <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>ID</Label>
                                                <Input
                                                    type="number"
                                                    value={formData.ID || ''}
                                                    onChange={(e) => handleFormChange('ID', Number(e.target.value))}
                                                />
                                            </div>
                                            {tipoModificacion !== 'RESERVA_INVENTARIO' && (
                                                <div>
                                                    <Label>Producto</Label>
                                                    <Input
                                                        value={formData.PRODUCTO || ''}
                                                        onChange={(e) => handleFormChange('PRODUCTO', e.target.value)}
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <Label>Variable (formato: Variable:SKU o solo Variable)</Label>
                                                <Textarea
                                                    value={formData.VARIABLE || ''}
                                                    onChange={(e) => handleFormChange('VARIABLE', e.target.value)}
                                                    placeholder="X1 UNIDAD:123, X2 UNIDADES:456 o X1 UNIDAD"
                                                />
                                            </div>
                                            <div>
                                                <Label>SKU</Label>
                                                <Input
                                                    value={formData["SKU "] || ''}
                                                    onChange={(e) => handleFormChange('SKU ', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label>Precio</Label>
                                                <Input
                                                    type="number"
                                                    value={formData["PRECIO "] || ''}
                                                    onChange={(e) => handleFormChange('PRECIO ', Number(e.target.value))}
                                                />
                                            </div>
                                            <div>
                                                <Label>Plataforma</Label>
                                                <Select value={formData.PLATAFORMA || ''} onValueChange={(value) => handleFormChange('PLATAFORMA', value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecciona una plataforma" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {plataformas.map((plat) => (
                                                            <SelectItem key={plat} value={plat}>
                                                                {plat}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Bodega</Label>
                                                <Select value={formData.BODEGA || ''} onValueChange={(value) => handleFormChange('BODEGA', value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecciona una bodega" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="INGENIO">INGENIO</SelectItem>
                                                        <SelectItem value="LABORATORIO">LABORATORIO</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Comercial</Label>
                                                <Select value={formData.COMERCIAL || ''} onValueChange={(value) => {
                                                    const selectedUser = comercialUsers.find(u => u.name === value);
                                                    if (selectedUser) {
                                                        handleFormChange('COMERCIAL', selectedUser.name);
                                                        handleFormChange('CODIGO COMERCIAL', selectedUser.code);
                                                    }
                                                }}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecciona un comercial" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {comercialUsers.map((user) => (
                                                            <SelectItem key={user.name} value={user.name}>
                                                                {user.name} ({user.code})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Código Comercial</Label>
                                                <Input
                                                    value={formData["CODIGO COMERCIAL"] || ''}
                                                    onChange={(e) => handleFormChange('CODIGO COMERCIAL', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label>Privado/Público</Label>
                                                <Select value={formData["PRIVADO_PUBLICO"] || ''} onValueChange={(value) => handleFormChange('PRIVADO_PUBLICO', value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecciona una opción" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Publico">Publico</SelectItem>
                                                        <SelectItem value="Privado">Privado</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            
                                            {/* Campos específicos para RESERVA_INVENTARIO */}
                                            {tipoModificacion === 'RESERVA_INVENTARIO' && (
                                                <>
                                                    <div>
                                                        <Label>Plataforma de Venta *</Label>
                                                        <Select 
                                                            value={formData.platformId || ''} 
                                                            onValueChange={(value) => handleFormChange('platformId', value)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Selecciona la plataforma" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {plataformas.map((plat) => (
                                                                    <SelectItem key={plat} value={plat}>
                                                                        {plat}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label>Correo del Cliente *</Label>
                                                        <Input
                                                            type="email"
                                                            value={formData.customerEmail || ''}
                                                            onChange={(e) => handleFormChange('customerEmail', e.target.value)}
                                                            placeholder="cliente@ejemplo.com"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Variante (opcional)</Label>
                                                        <Input
                                                            value={formData.variantId || ''}
                                                            onChange={(e) => handleFormChange('variantId', e.target.value)}
                                                            placeholder="ID de variante si aplica"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                            
                                            <div>
                                                <Label>Correo/Código (separados por coma)</Label>
                                                <Textarea
                                                    value={formData["CORREO_CODIGO"] || ''}
                                                    onChange={(e) => handleFormChange('CORREO_CODIGO', e.target.value)}
                                                    placeholder="email1@example.com, email2@example.com"
                                                />
                                            </div>
                                            <div>
                                                <Label>Creado</Label>
                                                <Select value={formData.CREADO || ''} onValueChange={(value) => handleFormChange('CREADO', value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecciona una opción" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="SI">SI</SelectItem>
                                                        <SelectItem value="NO">NO</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Solicitud</Label>
                                                <Select value={formData.SOLICITUD || ''} onValueChange={(value) => handleFormChange('SOLICITUD', value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecciona una opción" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="SUMA">SUMA</SelectItem>
                                                        <SelectItem value="AJUSTE">AJUSTE</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Cantidad Previa</Label>
                                                <Input
                                                    type="number"
                                                    value={formData["CANTIDAD PREVIA"] || ''}
                                                    onChange={(e) => handleFormChange('CANTIDAD PREVIA', Number(e.target.value))}
                                                />
                                            </div>
                                            <div>
                                                <Label>Cantidad Solicitada</Label>
                                                <Input
                                                    type="number"
                                                    value={formData["CANTIDAD SOLICITADA"] || ''}
                                                    onChange={(e) => handleFormChange('CANTIDAD SOLICITADA', Number(e.target.value))}
                                                />
                                            </div>
                                            <div>
                                                <Label>Cantidad Posterior</Label>
                                                <Input
                                                    type="number"
                                                    value={formData["CANTIDAD POSTERIOR"] || ''}
                                                    disabled
                                                />
                                            </div>
                                            <div>
                                                <Label>País * (Obligatorio)</Label>
                                                <Select value={formData.PAIS || ''} onValueChange={(value) => handleFormChange('PAIS', value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecciona un país" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {PAISES.map(pais => (
                                                            <SelectItem key={pais} value={pais}>{pais}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex justify-end mt-4">
                                            <Button onClick={editingItem ? handleEdit : handleCreate}>
                                                {editingItem ? 'Actualizar' : 'Crear'}
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <>
                        <div className="mb-4">
                            <p>Total de registros: {totalRecords}</p>
                        </div>
                        {loading ? (
                            <p>Cargando datos...</p>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Variable</TableHead>
                                            <TableHead>SKU</TableHead>
                                            <TableHead>Precio</TableHead>
                                            <TableHead>Plataforma</TableHead>
                                            <TableHead>Bodega</TableHead>
                                            <TableHead>Comercial</TableHead>
                                            <TableHead>Código Comercial</TableHead>
                                            <TableHead>Privado/Público</TableHead>
                                            <TableHead>Correo/Código</TableHead>
                                            <TableHead>Creado</TableHead>
                                            <TableHead>Solicitud</TableHead>
                                            <TableHead>Cantidad Previa</TableHead>
                                            <TableHead>Cantidad Solicitada</TableHead>
                                            <TableHead>Cantidad Posterior</TableHead>
                                            <TableHead>ID Consecutivo</TableHead>
                                            <TableHead>País</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>ID Reserva</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedData.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell>{row.FECHA ? new Date(row.FECHA).toLocaleDateString() : ''}</TableCell>
                                                <TableCell>{row.ID}</TableCell>
                                                <TableCell>{row.PRODUCTO}</TableCell>
                                                <TableCell>{row.VARIABLE}</TableCell>
                                                <TableCell>{row["SKU "]}</TableCell>
                                                <TableCell>{row["PRECIO "]}</TableCell>
                                                <TableCell>{row.PLATAFORMA}</TableCell>
                                                <TableCell>{row.BODEGA}</TableCell>
                                                <TableCell>{row.COMERCIAL}</TableCell>
                                                <TableCell>{row["CODIGO COMERCIAL"]}</TableCell>
                                                <TableCell>{row["PRIVADO_PUBLICO"]}</TableCell>
                                                <TableCell>{row["CORREO_CODIGO"]}</TableCell>
                                                <TableCell>{row.CREADO}</TableCell>
                                                <TableCell>{row.SOLICITUD}</TableCell>
                                                <TableCell>{row["CANTIDAD PREVIA"]}</TableCell>
                                                <TableCell>{row["CANTIDAD SOLICITADA"]}</TableCell>
                                                <TableCell>{row["CANTIDAD POSTERIOR"]}</TableCell>
                                                <TableCell>{row["ID CONSECUTIVO"]}</TableCell>
                                                <TableCell>{row.PAIS}</TableCell>
                                                <TableCell>
                                                    {row.tipoModificacion === 'RESERVA_INVENTARIO' && 'Reserva'}
                                                    {row.tipoModificacion === 'AJUSTE_STOCK' && 'Ajuste'}
                                                    {row.tipoModificacion === 'BAJA_PLATAFORMA' && 'Baja'}
                                                    {!row.tipoModificacion && '-'}
                                                </TableCell>
                                                <TableCell>{row.reservationId || '-'}</TableCell>
                                                <TableCell>
                                                    {row.estadoSolicitud === 'completado' && 'Completado'}
                                                    {row.estadoSolicitud === 'pendiente' && 'Pendiente'}
                                                    {!row.estadoSolicitud && '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        {canCreateOrUpdate && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openEditDialog(row)}
                                                            >
                                                                Editar
                                                            </Button>
                                                        )}
                                                        {canDelete && (
                                                            <Button
                                                                variant="destructive"
                                                                size="sm"
                                                                onClick={() => handleDelete(row.id)}
                                                            >
                                                                Eliminar
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center gap-2">
                                        <Label>Registros por página:</Label>
                                        <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                                            <SelectTrigger className="w-20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="20">20</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                                <SelectItem value="200">200</SelectItem>
                                                <SelectItem value="500">500</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button onClick={handlePrevPage} disabled={currentPage === 1}>
                                            Anterior
                                        </Button>
                                        <span>Página {currentPage} de {totalPages}</span>
                                        <Button onClick={handleNextPage} disabled={currentPage === totalPages}>
                                            Siguiente
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                </CardContent>
            </Card>
        </div>
    );
}
