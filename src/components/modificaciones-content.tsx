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
import { getModificaciones, createModificacion, updateModificacion, deleteModificacion, getComercialUsers, getPlataformas, type Modificacion } from '@/app/actions/modificaciones';
import { Textarea } from '@/components/ui/textarea';

export function ModificacionesContent() {
    const { user } = useAuth();
    const [data, setData] = useState<(Modificacion & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [pageSize, setPageSize] = useState<number>(20);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<(Modificacion & { id: string }) | null>(null);
    const [comercialUsers, setComercialUsers] = useState<string[]>([]);
    const [plataformas, setPlataformas] = useState<string[]>([]);
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
        "PRIVADO/PUBLICO": '',
        "CORREO/CODIGO": '',
        CREADO: '',
        SOLICITUD: '',
        "CANTIDAD PREVIA": null,
        "CANTIDAD SOLICITADA": null,
        "CANTIDAD POSTERIOR": null,
    });

    const fetchData = async (start?: Date, end?: Date) => {
        setLoading(true);
        try {
            const result = await getModificaciones(start, end);
            setData(result);
            setCurrentPage(1); // Reset to first page on new data
        } catch (error) {
            console.error('Error fetching modificaciones:', error);
        } finally {
            setLoading(false);
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
                setComercialUsers(['Maria del mar Garay', 'Camilo Useche']); // Fallback
            }
        };
        const fetchPlataformas = async () => {
            try {
                const plats = await getPlataformas();
                setPlataformas(plats);
            } catch (error) {
                console.error('Error fetching plataformas:', error);
                setPlataformas([]); // Fallback
            }
        };
        fetchComercialUsers();
        fetchPlataformas();
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
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleCreate = async () => {
        try {
            const variables = formData.VARIABLE ? formData.VARIABLE.split(',').map(v => v.trim()) : [''];
            const emails = formData["CORREO/CODIGO"] ? formData["CORREO/CODIGO"].split(',').map(e => e.trim()) : [''];

            for (const variable of variables) {
                const [varName, sku] = variable.includes(':') ? variable.split(':') : [variable, formData["SKU "] || ''];
                for (const email of emails) {
                    const record = {
                        ...formData,
                        VARIABLE: varName,
                        "SKU ": sku,
                        "CORREO/CODIGO": email,
                    };
                    await createModificacion(record as Omit<Modificacion, 'ID CONSECUTIVO'>);
                }
            }

            setDialogOpen(false);
            resetForm();
            fetchData(); // Refresh data
        } catch (error) {
            console.error('Error creating modificacion:', error);
        }
    };

    const handleEdit = async () => {
        if (!editingItem) return;

        try {
            await updateModificacion(editingItem.id, formData);
            setDialogOpen(false);
            setEditingItem(null);
            resetForm();
            fetchData(); // Refresh data
        } catch (error) {
            console.error('Error updating modificacion:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta modificación?')) return;

        try {
            // Note: We'll need to add deleteModificacion function
            await deleteModificacion(id);
            fetchData(); // Refresh data
        } catch (error) {
            console.error('Error deleting modificacion:', error);
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
            "PRIVADO/PUBLICO": '',
            "CORREO/CODIGO": '',
            CREADO: '',
            SOLICITUD: '',
            "CANTIDAD PREVIA": null,
            "CANTIDAD SOLICITADA": null,
            "CANTIDAD POSTERIOR": null,
        });
    };

    const openEditDialog = (item: Modificacion & { id: string }) => {
        setEditingItem(item);
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
            "PRIVADO/PUBLICO": item["PRIVADO/PUBLICO"] || '',
            "CORREO/CODIGO": item["CORREO/CODIGO"] || '',
            CREADO: item.CREADO || '',
            SOLICITUD: item.SOLICITUD || '',
            "CANTIDAD PREVIA": item["CANTIDAD PREVIA"] || null,
            "CANTIDAD SOLICITADA": item["CANTIDAD SOLICITADA"] || null,
            "CANTIDAD POSTERIOR": item["CANTIDAD POSTERIOR"] || null,
        });
        setDialogOpen(true);
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
                    <div className="flex justify-between items-end">
                        <div className="flex gap-4 items-end">
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
                        <Button onClick={handleFilter}>Filtrar</Button>
                        </div>
                        {user?.role === 'plataformas' && (
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>ID</Label>
                                        <Input
                                            type="number"
                                            value={formData.ID || ''}
                                            onChange={(e) => handleFormChange('ID', Number(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <Label>Producto</Label>
                                        <Input
                                            value={formData.PRODUCTO || ''}
                                            onChange={(e) => handleFormChange('PRODUCTO', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Variable (formato: Variable:SKU, Variable:SKU)</Label>
                                        <Textarea
                                            value={formData.VARIABLE || ''}
                                            onChange={(e) => handleFormChange('VARIABLE', e.target.value)}
                                            placeholder="X1 UNIDAD:123, X2 UNIDADES:456"
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
                                        <Select value={formData.COMERCIAL || ''} onValueChange={(value) => handleFormChange('COMERCIAL', value)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona un comercial" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {comercialUsers.map((user) => (
                                                    <SelectItem key={user} value={user}>
                                                        {user}
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
                                        <Input
                                            value={formData["PRIVADO/PUBLICO"] || ''}
                                            onChange={(e) => handleFormChange('PRIVADO/PUBLICO', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Correo/Código (separados por coma)</Label>
                                        <Textarea
                                            value={formData["CORREO/CODIGO"] || ''}
                                            onChange={(e) => handleFormChange('CORREO/CODIGO', e.target.value)}
                                            placeholder="email1@example.com, email2@example.com"
                                        />
                                    </div>
                                    <div>
                                        <Label>Creado</Label>
                                        <Input
                                            value={formData.CREADO || ''}
                                            onChange={(e) => handleFormChange('CREADO', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Solicitud</Label>
                                        <Input
                                            value={formData.SOLICITUD || ''}
                                            onChange={(e) => handleFormChange('SOLICITUD', e.target.value)}
                                        />
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
                                            onChange={(e) => handleFormChange('CANTIDAD POSTERIOR', Number(e.target.value))}
                                        />
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
                                            <TableHead>Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedData.map((row, index) => (
                                            <TableRow key={index}>
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
                                                <TableCell>{row["PRIVADO/PUBLICO"]}</TableCell>
                                                <TableCell>{row["CORREO/CODIGO"]}</TableCell>
                                                <TableCell>{row.CREADO}</TableCell>
                                                <TableCell>{row.SOLICITUD}</TableCell>
                                                <TableCell>{row["CANTIDAD PREVIA"]}</TableCell>
                                                <TableCell>{row["CANTIDAD SOLICITADA"]}</TableCell>
                                                <TableCell>{row["CANTIDAD POSTERIOR"]}</TableCell>
                                                <TableCell>{row["ID CONSECUTIVO"]}</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        {(user?.role === 'plataformas' || user?.role === 'admin') && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => openEditDialog(row)}
                                                            >
                                                                Editar
                                                            </Button>
                                                        )}
                                                        {user?.role === 'admin' && (
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