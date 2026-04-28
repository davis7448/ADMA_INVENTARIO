"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Phone, Mail, MapPin, Calendar, DollarSign, Plus, Pencil, TestTube, FileText, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import Link from 'next/link';
import { getClientById, updateClient, addNoteToClient, addOrderToClient, addTestToClient, getProductsWithStock, type ProductForOrder } from '@/lib/commercial-api';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { CommercialClient, ClientNote, ClientOrder, ClientTest, ClientStatus, ClientCategory, ClientType } from '@/types/commercial';

export default function ClientDetailPage() {
    const params = useParams();
    const { toast } = useToast();
    const [client, setClient] = useState<CommercialClient | null>(null);
    const [loading, setLoading] = useState(true);

    // Estado de edición
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<CommercialClient>>({});
    const [isSaving, setIsSaving] = useState(false);

    const openEdit = () => {
        if (!client) return;
        setEditForm({
            name: client.name,
            email: client.email,
            phone: client.phone,
            city: client.city,
            category: client.category,
            type: client.type,
            avg_sales: client.avg_sales,
            birthday: client.birthday
                ? new Date(client.birthday).toISOString().split('T')[0]
                : '',
        });
        setIsEditOpen(true);
    };

    const handleEditSave = async () => {
        if (!client?.id) return;
        setIsSaving(true);
        try {
            await updateClient(client.id, {
                ...editForm,
                birthday: editForm.birthday ? new Date(editForm.birthday as string) : client.birthday,
            });
            const updated = await getClientById(client.id);
            setClient(updated);
            setIsEditOpen(false);
            toast({ title: 'Cliente actualizado correctamente.' });
        } catch {
            toast({ title: 'Error al guardar', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    // Estados para notas
    const [newNoteContent, setNewNoteContent] = useState('');
    const [isAddingNote, setIsAddingNote] = useState(false);
    
    // Estados para pedidos
    const [isAddingOrder, setIsAddingOrder] = useState(false);
    const [orderItems, setOrderItems] = useState([{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
    const [orderStatus, setOrderStatus] = useState<'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'>('pending');
    const [availableProducts, setAvailableProducts] = useState<ProductForOrder[]>([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [productComboboxOpen, setProductComboboxOpen] = useState<boolean[]>([]);
    
    // Estados para testeos
    const [isAddingTest, setIsAddingTest] = useState(false);
    const [testItems, setTestItems] = useState([{ product_id: '', product_name: '', notes: '' }]);
    const [testStatus, setTestStatus] = useState<'pending' | 'in_progress' | 'completed' | 'failed'>('pending');
    const [testResult, setTestResult] = useState<'positive' | 'negative' | 'neutral' | 'pending'>('pending');
    const [testProductComboboxOpen, setTestProductComboboxOpen] = useState<boolean[]>([]);

    useEffect(() => {
        const fetchClient = async () => {
            try {
                const clientId = params.id as string;
                console.log('[DEBUG] fetchClient - clientId:', clientId);
                const clientData = await getClientById(clientId);
                console.log('[DEBUG] fetchClient - clientData:', {
                    id: clientData?.id,
                    name: clientData?.name,
                    notes_count: clientData?.notes?.length,
                    orders_count: clientData?.orders?.length,
                    tests_count: clientData?.tests?.length
                });
                setClient(clientData);
            } catch (error) {
                console.error('Error fetching client:', error);
            } finally {
                setLoading(false);
            }
        };

        if (params.id) {
            fetchClient();
        }
    }, [params.id]);

    const handleAddNote = async () => {
        if (!client?.id || !newNoteContent.trim()) return;
        
        setIsAddingNote(true);
        try {
            await addNoteToClient(client.id, newNoteContent);
            // Refresh client data
            const updatedClient = await getClientById(client.id);
            setClient(updatedClient);
            setNewNoteContent('');
        } catch (error) {
            console.error('Error adding note:', error);
        } finally {
            setIsAddingNote(false);
        }
    };

    const handleAddOrder = async () => {
        if (!client?.id || orderItems.length === 0) return;
        
        setIsAddingOrder(true);
        try {
            await addOrderToClient(client.id, orderItems, orderStatus);
            // Refresh client data
            const updatedClient = await getClientById(client.id);
            setClient(updatedClient);
            setOrderItems([{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
            setOrderStatus('pending');
            setProductComboboxOpen([]);
        } catch (error) {
            console.error('Error adding order:', error);
        } finally {
            setIsAddingOrder(false);
        }
    };

    const handleAddTest = async () => {
        if (!client?.id || testItems.length === 0 || testItems.every(item => !item.product_id)) return;
        
        setIsAddingTest(true);
        try {
            await addTestToClient(client.id, testItems, testStatus, testResult);
            // Refresh client data
            const updatedClient = await getClientById(client.id);
            setClient(updatedClient);
            setTestItems([{ product_id: '', product_name: '', notes: '' }]);
            setTestStatus('pending');
            setTestResult('pending');
            setTestProductComboboxOpen([]);
        } catch (error) {
            console.error('Error adding test:', error);
        } finally {
            setIsAddingTest(false);
        }
    };

    const addOrderItem = () => {
        setOrderItems([...orderItems, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
        setProductComboboxOpen([...productComboboxOpen, false]);
    };

    const loadProducts = async () => {
        if (availableProducts.length > 0) return; // Already loaded
        setProductsLoading(true);
        try {
            const products = await getProductsWithStock();
            setAvailableProducts(products);
            // Initialize combobox states for existing items
            setProductComboboxOpen(new Array(orderItems.length).fill(false));
        } catch (error) {
            console.error('Error loading products:', error);
        } finally {
            setProductsLoading(false);
        }
    };

    const handleProductSelect = (index: number, product: ProductForOrder) => {
        const updated = [...orderItems];
        updated[index] = {
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            unit_price: product.salePrice
        };
        setOrderItems(updated);
        
        // Close the combobox for this item
        const newComboboxState = [...productComboboxOpen];
        newComboboxState[index] = false;
        setProductComboboxOpen(newComboboxState);
    };

    const updateOrderItem = (index: number, field: string, value: string | number) => {
        const updated = [...orderItems];
        (updated[index] as any)[field] = value;
        setOrderItems(updated);
    };

    const removeOrderItem = (index: number) => {
        setOrderItems(orderItems.filter((_, i) => i !== index));
    };

    const addTestItem = () => {
        setTestItems([...testItems, { product_id: '', product_name: '', notes: '' }]);
        setTestProductComboboxOpen([...testProductComboboxOpen, false]);
    };

    const handleTestProductSelect = (index: number, product: ProductForOrder) => {
        const updated = [...testItems];
        updated[index] = {
            ...updated[index],
            product_id: product.id,
            product_name: product.name
        };
        setTestItems(updated);
        
        // Close the combobox for this item
        const newComboboxState = [...testProductComboboxOpen];
        newComboboxState[index] = false;
        setTestProductComboboxOpen(newComboboxState);
    };

    const updateTestItem = (index: number, field: string, value: string) => {
        const updated = [...testItems];
        (updated[index] as any)[field] = value;
        setTestItems(updated);
    };

    const removeTestItem = (index: number) => {
        setTestItems(testItems.filter((_, i) => i !== index));
    };

    const formatDate = (date: Date | any) => {
        if (!date) return 'Sin fecha';
        try {
            // Handle Firestore Timestamp
            if (date && typeof date === 'object' && 'toDate' in date) {
                date = date.toDate();
            }
            const d = new Date(date);
            if (isNaN(d.getTime())) return 'Fecha inválida';
            return d.toLocaleDateString('es-CO', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return 'Error de fecha';
        }
    };

    // Función para formatear tiempo relativo
    const getRelativeTime = (date: Date | any): string => {
        if (!date) return '';
        const now = new Date();
        const d = new Date(date);
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        const diffWeeks = Math.floor(diffDays / 7);
        const diffMonths = Math.floor(diffDays / 30);

        if (diffMins < 1) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
        if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
        if (diffWeeks < 4) return `Hace ${diffWeeks} semana${diffWeeks > 1 ? 's' : ''}`;
        if (diffMonths < 12) return `Hace ${diffMonths} mes${diffMonths > 1 ? 'es' : ''}`;
        return formatDate(date);
    };

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'selling':
            case 'delivered':
            case 'completed':
            case 'positive':
                return 'default';
            case 'testing':
            case 'confirmed':
            case 'in_progress':
                return 'secondary';
            case 'pending':
            case 'neutral':
                return 'outline';
            case 'cancelled':
            case 'failed':
            case 'negative':
                return 'destructive';
            default:
                return 'secondary';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'pending': 'Pendiente',
            'confirmed': 'Confirmado',
            'shipped': 'Enviado',
            'delivered': 'Entregado',
            'cancelled': 'Cancelado',
            'in_progress': 'En Progreso',
            'completed': 'Completado',
            'failed': 'Fallido',
            'positive': 'Positivo',
            'negative': 'Negativo',
            'neutral': 'Neutral'
        };
        return labels[status] || status;
    };

    if (loading) return <div className="p-8">Cargando...</div>;
    if (!client) return <div className="p-8">Cliente no encontrado</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/commercial/crm/dashboard">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Badge variant={client.status === 'selling' ? 'default' : 'secondary'}>
                            {client.status.toUpperCase()}
                        </Badge>
                        <span>• {client.category}</span>
                    </div>
                </div>
                <div className="ml-auto">
                    <Button variant="outline" onClick={openEdit}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                    </Button>
                </div>

                {/* Dialog de edición */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Editar Cliente</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-1 gap-4 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Nombre</Label>
                                    <Input
                                        value={editForm.name ?? ''}
                                        onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Ciudad</Label>
                                    <Input
                                        value={editForm.city ?? ''}
                                        onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Email</Label>
                                    <Input
                                        type="email"
                                        value={editForm.email ?? ''}
                                        onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Teléfono</Label>
                                    <Input
                                        value={editForm.phone ?? ''}
                                        onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Categoría</Label>
                                    <Select
                                        value={editForm.category}
                                        onValueChange={v => setEditForm(p => ({ ...p, category: v as ClientCategory }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="laboratorio">Laboratorio</SelectItem>
                                            <SelectItem value="chino">Chino</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Tipo</Label>
                                    <Select
                                        value={editForm.type}
                                        onValueChange={v => setEditForm(p => ({ ...p, type: v as ClientType }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="dropshipper">Dropshipper</SelectItem>
                                            <SelectItem value="ecommerce">E-commerce</SelectItem>
                                            <SelectItem value="mixto">Mixto</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Ventas promedio ($)</Label>
                                    <Input
                                        type="number"
                                        value={editForm.avg_sales ?? 0}
                                        onChange={e => setEditForm(p => ({ ...p, avg_sales: Number(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Cumpleaños</Label>
                                    <Input
                                        type="date"
                                        value={editForm.birthday as string ?? ''}
                                        onChange={e => setEditForm(p => ({ ...p, birthday: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleEditSave} disabled={isSaving}>
                                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Datos de Contacto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{client.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{client.phone}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{client.city}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Cumpleaños: {client.birthday ? new Date(client.birthday).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3 pt-4 border-t">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="font-bold text-lg">${(client.avg_sales || 0).toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground">Ventas Promedio</span>
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 space-y-6">
                    <Tabs defaultValue="notes">
                        <TabsList>
                            <TabsTrigger value="notes" className="gap-2">
                                <FileText className="h-4 w-4" /> Notas
                            </TabsTrigger>
                            <TabsTrigger value="orders" className="gap-2">
                                <DollarSign className="h-4 w-4" /> Pedidos
                            </TabsTrigger>
                            <TabsTrigger value="tests" className="gap-2">
                                <TestTube className="h-4 w-4" /> Testeos
                            </TabsTrigger>
                        </TabsList>
                        
                        {/* Pestaña de Notas */}
                        <TabsContent value="notes" className="space-y-4 pt-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-base">Notas del Cliente</CardTitle>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="gap-2">
                                                <Plus className="h-4 w-4" /> Nueva Nota
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Agregar Nota</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 pt-4">
                                                <Textarea 
                                                    placeholder="Escribe una nota..." 
                                                    value={newNoteContent}
                                                    onChange={(e) => setNewNoteContent(e.target.value)}
                                                    rows={4}
                                                />
                                                <Button 
                                                    onClick={handleAddNote} 
                                                    disabled={isAddingNote || !newNoteContent.trim()}
                                                    className="w-full"
                                                >
                                                    {isAddingNote ? 'Guardando...' : 'Guardar Nota'}
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </CardHeader>
                                <CardContent>
                                    {client.notes && Array.isArray(client.notes) && client.notes.length > 0 ? (
                                        <div className="relative">
                                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-200" />
                                            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4">
                                                {(client.notes as ClientNote[])
                                                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                    .map((note: ClientNote, index: number) => (
                                                        <div key={note.id} className="relative pl-10">
                                                            <div className="absolute left-2 top-2 h-4 w-4 rounded-full bg-blue-500 border-2 border-white" />
                                                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                                                <p className="font-medium text-gray-900">{note.content}</p>
                                                                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                                                    <Calendar className="h-3 w-3" />
                                                                    <span>{formatDate(note.created_at)}</span>
                                                                    <span className="text-blue-600 font-medium">• {getRelativeTime(note.created_at)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center p-8 text-muted-foreground">
                                            No hay notas registradas aún.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        
                        {/* Pestaña de Pedidos */}
                        <TabsContent value="orders" className="space-y-4 pt-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-base">Pedidos del Cliente</CardTitle>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="gap-2"
                                                onClick={() => {
                                                    loadProducts();
                                                }}
                                            >
                                                <Plus className="h-4 w-4" /> Nuevo Pedido
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl">
                                            <DialogHeader>
                                                <DialogTitle>Agregar Pedido</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 pt-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Estado del Pedido</label>
                                                    <Select value={orderStatus} onValueChange={(v: any) => setOrderStatus(v)}>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="pending">Pendiente</SelectItem>
                                                            <SelectItem value="confirmed">Confirmado</SelectItem>
                                                            <SelectItem value="shipped">Enviado</SelectItem>
                                                            <SelectItem value="delivered">Entregado</SelectItem>
                                                            <SelectItem value="cancelled">Cancelado</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-sm font-medium">Productos</label>
                                                        <Button size="sm" variant="outline" onClick={addOrderItem} type="button">
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    {orderItems.map((item, index) => (
                                                        <div key={`order-item-${index}-${item.product_id}`} className="flex gap-2 items-end">
                                                            <div className="flex-1">
                                                                <Popover open={productComboboxOpen[index]} onOpenChange={(open) => {
                                                                    const newState = [...productComboboxOpen];
                                                                    newState[index] = open;
                                                                    setProductComboboxOpen(newState);
                                                                }}>
                                                                    <PopoverTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            role="combobox"
                                                                            className="w-full justify-between font-normal"
                                                                        >
                                                                            {item.product_name || "Seleccionar producto..."}
                                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-[300px] p-0" align="start">
                                                                        <Command>
                                                                            <CommandInput placeholder="Buscar producto..." />
                                                                            <CommandList>
                                                                                {productsLoading ? (
                                                                                    <CommandEmpty>Cargando productos...</CommandEmpty>
                                                                                ) : availableProducts.length === 0 ? (
                                                                                    <CommandEmpty>No hay productos disponibles</CommandEmpty>
                                                                                ) : (
                                                                                    availableProducts.map((product) => (
                                                                                        <CommandItem
                                                                                            key={product.id}
                                                                                            value={product.name}
                                                                                            onSelect={() => handleProductSelect(index, product)}
                                                                                        >
                                                                                            <Check
                                                                                                className={`mr-2 h-4 w-4 ${
                                                                            item.product_id === product.id ? "opacity-100" : "opacity-0"
                                                                        }`}
                                                                                            />
                                                                                            <div className="flex flex-col">
                                                                                                <span>{product.name}</span>
                                                                                                <span className="text-xs text-muted-foreground">
                                                                                                    Stock: {product.stock} | Precio: ${product.salePrice.toLocaleString()}
                                                                                                </span>
                                                                                            </div>
                                                                                        </CommandItem>
                                                                                    ))
                                                                                )}
                                                                            </CommandList>
                                                                        </Command>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </div>
                                                            <div className="w-24 space-y-1">
                                                                <label className="text-xs font-medium text-muted-foreground">Cant.</label>
                                                                <Input 
                                                                    type="number"
                                                                    placeholder="Cant."
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                                                />
                                                            </div>
                                                            <div className="w-28 space-y-1">
                                                                <label className="text-xs font-medium text-muted-foreground">Precio</label>
                                                                <Input 
                                                                    type="number"
                                                                    placeholder="Precio"
                                                                    value={item.unit_price}
                                                                    onChange={(e) => updateOrderItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                                />
                                                            </div>
                                                            {orderItems.length > 1 && (
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    onClick={() => removeOrderItem(index)}
                                                                    type="button"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <div className="pt-4 border-t">
                                                    <p className="text-lg font-bold">
                                                        Total: ${orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toLocaleString()}
                                                    </p>
                                                </div>
                                                
                                                <Button 
                                                    onClick={handleAddOrder} 
                                                    disabled={isAddingOrder || orderItems.every(i => !i.product_name)}
                                                    className="w-full"
                                                >
                                                    {isAddingOrder ? 'Guardando...' : 'Guardar Pedido'}
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </CardHeader>
                                <CardContent>
                                    {client.orders && client.orders.length > 0 ? (
                                        <div className="relative">
                                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-green-200" />
                                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4">
                                                {[...client.orders]
                                                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                    .map((order: ClientOrder) => (
                                                        <div key={order.id} className="relative pl-10">
                                                            <div className="absolute left-2 top-2 h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
                                                            <div className="bg-green-50 rounded-lg p-4 border border-green-100 space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant={getStatusBadgeVariant(order.status)}>
                                                                            {getStatusLabel(order.status)}
                                                                        </Badge>
                                                                    </div>
                                                                    <span className="font-bold text-green-700">${order.total.toLocaleString()}</span>
                                                                </div>
                                                                <div className="text-sm text-gray-600">
                                                                    {order.items.map((item, i) => (
                                                                        <div key={`${order.id}-item-${i}`} className="flex justify-between py-1">
                                                                            <span>{item.product_name} x{item.quantity}</span>
                                                                            <span className="font-medium">${item.total.toLocaleString()}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="flex items-center gap-2 pt-2 border-t border-green-200 text-sm text-muted-foreground">
                                                                    <Calendar className="h-3 w-3" />
                                                                    <span>{formatDate(order.created_at)}</span>
                                                                    <span className="text-green-600 font-medium">• {getRelativeTime(order.created_at)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center p-8 text-muted-foreground">
                                            No hay pedidos registrados aún.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        
                        {/* Pestaña de Testeos */}
                        <TabsContent value="tests" className="space-y-4 pt-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-base">Testeos del Cliente</CardTitle>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="gap-2">
                                                <Plus className="h-4 w-4" /> Nuevo Test
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl">
                                            <DialogHeader>
                                                <DialogTitle>Agregar Test</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 pt-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Estado</label>
                                                    <Select value={testStatus} onValueChange={(v: any) => setTestStatus(v)}>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="pending">Pendiente</SelectItem>
                                                            <SelectItem value="in_progress">En Progreso</SelectItem>
                                                            <SelectItem value="completed">Completado</SelectItem>
                                                            <SelectItem value="failed">Fallido</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">Resultado</label>
                                                    <Select value={testResult} onValueChange={(v: any) => setTestResult(v)}>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="pending">Pendiente</SelectItem>
                                                            <SelectItem value="positive">Positivo</SelectItem>
                                                            <SelectItem value="negative">Negativo</SelectItem>
                                                            <SelectItem value="neutral">Neutral</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-sm font-medium">Productos</label>
                                                        <Button size="sm" variant="outline" onClick={addTestItem} type="button">
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    {testItems.map((item, index) => (
                                                        <div key={`test-item-${index}-${item.product_id}`} className="flex gap-2 items-end">
                                                            <div className="flex-1">
                                                                <Popover open={testProductComboboxOpen[index]} onOpenChange={(open) => {
                                                                    const newState = [...testProductComboboxOpen];
                                                                    newState[index] = open;
                                                                    setTestProductComboboxOpen(newState);
                                                                }}>
                                                                    <PopoverTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            role="combobox"
                                                                            className="w-full justify-between font-normal"
                                                                            onClick={() => {
                                                                                loadProducts();
                                                                                const newState = [...testProductComboboxOpen];
                                                                                newState[index] = true;
                                                                                setTestProductComboboxOpen(newState);
                                                                            }}
                                                                        >
                                                                            {item.product_name || "Seleccionar producto..."}
                                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-[350px] p-0" align="start">
                                                                        <Command>
                                                                            <CommandInput placeholder="Buscar producto..." />
                                                                            <CommandList>
                                                                                {productsLoading ? (
                                                                                    <CommandEmpty>Cargando productos...</CommandEmpty>
                                                                                ) : availableProducts.length === 0 ? (
                                                                                    <CommandEmpty>No hay productos disponibles</CommandEmpty>
                                                                                ) : (
                                                                                    availableProducts.map((product) => (
                                                                                        <CommandItem
                                                                                            key={product.id}
                                                                                            value={product.name}
                                                                                            onSelect={() => handleTestProductSelect(index, product)}
                                                                                        >
                                                                                            <Check
                                                                                                className={`mr-2 h-4 w-4 ${
                                                                                                    item.product_id === product.id ? "opacity-100" : "opacity-0"
                                                                                                }`}
                                                                                            />
                                                                                            <div className="flex flex-col">
                                                                                                <span>{product.name}</span>
                                                                                                <span className="text-xs text-muted-foreground">
                                                                                                    Stock: {product.stock} | Precio: ${product.salePrice.toLocaleString()}
                                                                                                </span>
                                                                                            </div>
                                                                                        </CommandItem>
                                                                                    ))
                                                                                )}
                                                                            </CommandList>
                                                                        </Command>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </div>
                                                            <div className="flex-1 space-y-1">
                                                                <label className="text-xs font-medium text-muted-foreground">Notas</label>
                                                                <Input 
                                                                    placeholder="Notas..."
                                                                    value={item.notes}
                                                                    onChange={(e) => updateTestItem(index, 'notes', e.target.value)}
                                                                />
                                                            </div>
                                                            {testItems.length > 1 && (
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    onClick={() => removeTestItem(index)}
                                                                    type="button"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                
                                                <Button 
                                                    onClick={handleAddTest} 
                                                    disabled={isAddingTest || testItems.every(item => !item.product_id)}
                                                    className="w-full"
                                                >
                                                    {isAddingTest ? 'Guardando...' : 'Guardar Test'}
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </CardHeader>
                                <CardContent>
                                    {client.tests && client.tests.length > 0 ? (
                                        <div className="relative">
                                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-orange-200" />
                                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4">
                                                {[...client.tests]
                                                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                    .map((test: ClientTest) => (
                                                        <div key={test.id} className="relative pl-10">
                                                            <div className="absolute left-2 top-2 h-4 w-4 rounded-full bg-orange-500 border-2 border-white" />
                                                            <div className="bg-orange-50 rounded-lg p-4 border border-orange-100 space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <TestTube className="h-4 w-4 text-orange-600" />
                                                                        <span className="font-medium">{test.product_name}</span>
                                                                    </div>
                                                                    <Badge variant={getStatusBadgeVariant(test.status)}>
                                                                        {getStatusLabel(test.status)}
                                                                    </Badge>
                                                                </div>
                                                                <div className="flex items-center justify-between text-sm">
                                                                    <span className="text-muted-foreground">Resultado:</span>
                                                                    <Badge variant={getStatusBadgeVariant(test.result || 'pending')}>
                                                                        {getStatusLabel(test.result || 'pending')}
                                                                    </Badge>
                                                                </div>
                                                                {test.notes && (
                                                                    <p className="text-sm text-gray-600 bg-white/50 rounded p-2">{test.notes}</p>
                                                                )}
                                                                <div className="flex items-center gap-2 pt-2 border-t border-orange-200 text-sm text-muted-foreground">
                                                                    <Calendar className="h-3 w-3" />
                                                                    <span>{formatDate(test.created_at)}</span>
                                                                    <span className="text-orange-600 font-medium">• {getRelativeTime(test.created_at)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center p-8 text-muted-foreground">
                                            No hay testeos registrados aún.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
