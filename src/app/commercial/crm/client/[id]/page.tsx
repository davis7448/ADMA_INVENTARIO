"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit, Phone, Mail, MapPin, Calendar, DollarSign, Plus, FileText, Upload, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { getClientById, updateClient, createClientTest, getClientTests, addClientEvent, getClientEvents, initializeClientEventsFromHistory } from '@/lib/commercial-api';
import { getProducts } from '@/lib/api';
import { CommercialClient, ClientStatus, ClientCategory, ClientType } from '@/types/commercial';
import { Product } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

type ClientNote = {
    id: string;
    content: string;
    created_at: any;
    created_by: string;
};

type ClientHistoryEvent = {
    id: string;
    type: 'status_change' | 'edit' | 'note' | 'order' | 'registered' | 'testing';
    description: string;
    created_at: any;
    created_by: string;
    details?: string;
};

type ClientTest = {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    platform: string;
    status: 'test_new' | 'active';
    created_at: any;
    created_by: string;
    created_by_name?: string;
};

type ClientOrder = {
    id: string;
    product_id: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    total: number;
    status: 'quotation' | 'pending' | 'paid';
    payment_proof?: string;
    created_at: any;
};

export default function ClientDetailPage() {
    const params = useParams();
    const { user } = useAuth();
    const [client, setClient] = useState<CommercialClient | null>(null);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState<ClientNote[]>([]);
    const [history, setHistory] = useState<ClientHistoryEvent[]>([]);
    const [orders, setOrders] = useState<ClientOrder[]>([]);
    const [tests, setTests] = useState<ClientTest[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [editOpen, setEditOpen] = useState(false);
    const [noteOpen, setNoteOpen] = useState(false);
    const [orderOpen, setOrderOpen] = useState(false);
    const [testOpen, setTestOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        phone: '',
        city: '',
        category: '' as ClientCategory,
        type: '' as ClientType,
        status: '' as ClientStatus,
        avg_sales: 0,
        notes: '',
    });

    const [newNote, setNewNote] = useState('');
    const [newOrder, setNewOrder] = useState({
        product_id: '',
        product_name: '',
        unit_price: 0,
        quantity: 1,
        total: 0,
        payment_proof: '',
    });
    
    const [newTest, setNewTest] = useState({
        product_id: '',
        product_name: '',
        product_sku: '',
        platform: '',
        status: 'test_new' as 'test_new' | 'active',
    });
    
    const [productSearch, setProductSearch] = useState('');
    const [productPage, setProductPage] = useState(0);
    const [editingPrice, setEditingPrice] = useState(false);
    const [tempUnitPrice, setTempUnitPrice] = useState(0);
    const PRODUCTS_PER_PAGE = 20;

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase())
    );
    const paginatedProducts = filteredProducts.slice(
        productPage * PRODUCTS_PER_PAGE,
        (productPage + 1) * PRODUCTS_PER_PAGE
    );
    const totalProductPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);

    // Función para agregar evento al historial (usa nueva API)
    const addHistoryEvent = async (type: ClientHistoryEvent['type'], description: string, details?: string) => {
        if (!client || !user) return;
        
        // Optimistic update - add to local state immediately
        const newEvent: ClientHistoryEvent = {
            id: `temp-${Date.now()}`,
            type,
            description,
            details,
            created_at: new Date(),
            created_by: user.name || 'Usuario',
        };
        setHistory(prev => [newEvent, ...prev]);
        
        // Save to Firestore (new separate collection)
        try {
            await addClientEvent(
                client!.id!,
                type,
                description,
                user!.id,
                user!.name || 'Usuario',
                details
            );
            
            // Refresh events from Firestore to get the real ID
            const events = await getClientEvents(client!.id!);
            const formattedEvents: ClientHistoryEvent[] = events.map(e => ({
                id: e.id,
                type: e.type,
                description: e.description,
                details: e.details,
                created_at: e.created_at,
                created_by: e.created_by_name || e.created_by
            }));
            setHistory(formattedEvents);
        } catch (error) {
            console.error('Error saving event:', error);
            // Revert optimistic update on error
            setHistory(prev => prev.filter(e => e.id !== newEvent.id));
        }
    };

    // Función para inicializar historial - migra eventos legacy si es necesario
    const initHistory = async (clientData: CommercialClient | null) => {
        console.log('[DEBUG] initHistory - clientData?.history:', clientData?.history);
        console.log('[DEBUG] initHistory - last_event_number:', clientData?.last_event_number);
        
        // First, try to load events from new collection
        if (clientData?.id) {
            try {
                const events = await getClientEvents(clientData.id);
                
                if (events.length > 0) {
                    console.log('[DEBUG] initHistory - Found events in client_events:', events.length);
                    const formattedEvents: ClientHistoryEvent[] = events.map(e => ({
                        id: e.id,
                        type: e.type,
                        description: e.description,
                        details: e.details,
                        created_at: e.created_at,
                        created_by: e.created_by_name || e.created_by
                    }));
                    setHistory(formattedEvents);
                    return;
                }
            } catch (error) {
                console.error('[DEBUG] initHistory - Error loading events:', error);
            }
        }
        
        // Fallback: use legacy history field and migrate if needed
        if (clientData?.history && Array.isArray(clientData.history) && clientData.history.length > 0) {
            console.log('[DEBUG] initHistory - Using legacy history:', clientData.history.length);
            
            // Convert timestamps
            const convertedHistory = clientData.history.map((event: any) => ({
                ...event,
                created_at: event.created_at?.toDate ? event.created_at.toDate() : 
                           event.created_at instanceof Date ? event.created_at :
                           new Date(event.created_at)
            }));
            convertedHistory.sort((a: any, b: any) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setHistory(convertedHistory);
            
            // Migrate to new collection if we have events
            if (clientData.id && clientData.history.length > 0) {
                console.log('[DEBUG] initHistory - Migrating legacy events to new collection');
                await initializeClientEventsFromHistory(
                    clientData.id, 
                    clientData.history, 
                    clientData.last_event_number || 0
                );
            }
        } else {
            console.log('[DEBUG] initHistory - No history found, creating initial event');
            const initialEvent: ClientHistoryEvent = {
                id: 'initial',
                type: 'registered',
                description: 'Cliente registrado',
                created_at: clientData?.created_at ? new Date(clientData.created_at) : new Date(),
                created_by: 'Sistema',
            };
            setHistory([initialEvent]);
            
            // Create initial event in new collection if client exists
            if (clientData?.id) {
                try {
                    await addClientEvent(
                        clientData.id,
                        'registered',
                        'Cliente registrado',
                        'system',
                        'Sistema',
                        undefined
                    );
                } catch (error) {
                    console.error('[DEBUG] initHistory - Error creating initial event:', error);
                }
            }
        }
    };

    useEffect(() => {
        async function loadClient() {
            const id = params.id as string;
            if (!id) return;
            
            try {
                const [data, testsData] = await Promise.all([
                    getClientById(id),
                    getClientTests(id)
                ]);
                setClient(data);
                if (data) {
                    setEditForm({
                        name: data.name || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        city: data.city || '',
                        category: data.category || 'laboratorio',
                        type: data.type || 'mixto',
                        status: data.status || 'finding_winner',
                        avg_sales: data.avg_sales || 0,
                        notes: data.notes || '',
                    });
                    initHistory(data);
                }
                
                const productsData = await getProducts({ fetchAll: true });
                setProducts(productsData.products);
                setTests(testsData);
            } catch (error) {
                console.error('Error loading client:', error);
            } finally {
                setLoading(false);
            }
        }
        loadClient();
    }, [params.id]);

    const handleSaveEdit = async () => {
        if (!client) return;
        setSaving(true);
        try {
            const changes: string[] = [];
            
            // Detectar cambios
            if (editForm.name !== client.name) changes.push(`Nombre: ${client.name} → ${editForm.name}`);
            if (editForm.email !== client.email) changes.push(`Email: ${client.email} → ${editForm.email}`);
            if (editForm.phone !== client.phone) changes.push(`Teléfono: ${client.phone} → ${editForm.phone}`);
            if (editForm.city !== client.city) changes.push(`Ciudad: ${client.city} → ${editForm.city}`);
            if (editForm.category !== client.category) changes.push(`Categoría: ${client.category} → ${editForm.category}`);
            if (editForm.type !== client.type) changes.push(`Tipo: ${client.type} → ${editForm.type}`);
            
            // Detectar cambio de estado
            if (editForm.status !== client.status) {
                const statusLabels: Record<string, string> = {
                    finding_winner: 'Encontrando Winner',
                    testing: 'Testeando',
                    selling: 'Vendiendo',
                    scaling: 'Escalando'
                };
                changes.push(`Estado: ${statusLabels[client.status] || client.status} → ${statusLabels[editForm.status] || editForm.status}`);
            }
            
            await updateClient(client.id!, {
                name: editForm.name,
                email: editForm.email,
                phone: editForm.phone,
                city: editForm.city,
                category: editForm.category,
                type: editForm.type,
                status: editForm.status,
                avg_sales: Number(editForm.avg_sales),
            });
            
            const updated = await getClientById(client.id!);
            setClient(updated);
            
            // Registrar en historial usando nuevo sistema de eventos
            if (changes.length > 0) {
                await addHistoryEvent('edit', 'Datos actualizados', changes.join(', '));
            }
            
            setEditOpen(false);
        } catch (error) {
            console.error('Error updating client:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || !client) return;
        const note: ClientNote = {
            id: Date.now().toString(),
            content: newNote,
            created_at: new Date(),
            created_by: user?.name || 'Usuario',
        };
        setNotes([note, ...notes]);
        await updateClient(client.id!, { notes: (client.notes || '') + '\n' + newNote });
        const updated = await getClientById(client.id!);
        setClient(updated);
        
        // Registrar en historial usando nuevo sistema de eventos
        await addHistoryEvent('note', 'Nota agregada', newNote.substring(0, 50) + (newNote.length > 50 ? '...' : ''));
        
        setNewNote('');
        setNoteOpen(false);
    };

    const handleProductChange = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setNewOrder({
                ...newOrder,
                product_id: productId,
                product_name: product.name,
                unit_price: product.priceDropshipping || 0,
                total: (product.priceDropshipping || 0) * newOrder.quantity,
            });
        }
    };

    const handleQuantityChange = (quantity: number) => {
        const qty = Math.max(1, quantity);
        setNewOrder({
            ...newOrder,
            quantity: qty,
            total: newOrder.unit_price * qty,
        });
    };

    const handlePaymentProof = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setNewOrder({
                ...newOrder,
                payment_proof: file.name,
            });
        }
    };

    const handleAddOrder = async () => {
        if (!newOrder.product_id.trim() || !client) return;
        
        const order: ClientOrder = {
            id: Date.now().toString(),
            product_id: newOrder.product_id,
            product_name: newOrder.product_name,
            unit_price: newOrder.unit_price,
            quantity: newOrder.quantity,
            total: newOrder.total,
            status: newOrder.payment_proof ? 'pending' : 'quotation',
            payment_proof: newOrder.payment_proof || undefined,
            created_at: new Date(),
        };
        
        setOrders([...orders, order]);
        
        // Registrar en historial usando nuevo sistema de eventos
        await addHistoryEvent('order', 'Pedido creado', `${order.product_name} x${order.quantity} - $${order.total.toLocaleString()}`);
        
        setNewOrder({ product_id: '', product_name: '', unit_price: 0, quantity: 1, total: 0, payment_proof: '' });
        setOrderOpen(false);
    };

    const handleAddTest = async () => {
        if (!newTest.product_id.trim() || !newTest.platform.trim() || !client) return;
        
        const statusLabel = newTest.status === 'active' ? 'Ya Activo' : 'Testeo Nuevo';
        
        // Guardar en Firestore
        const testId = await createClientTest({
            clientId: client!.id!,
            productId: newTest.product_id,
            productName: newTest.product_name,
            productSku: newTest.product_sku,
            platform: newTest.platform,
            status: newTest.status,
            created_by: user?.id || 'unknown',
            created_by_name: user?.name || 'Usuario'
        });
        
        const test: ClientTest = {
            id: testId,
            productId: newTest.product_id,
            productName: newTest.product_name,
            productSku: newTest.product_sku,
            platform: newTest.platform,
            status: newTest.status,
            created_at: new Date(),
            created_by: user?.id || 'unknown',
            created_by_name: user?.name || 'Usuario'
        };
        
        setTests([test, ...tests]);
        
        // Registrar en historial usando nuevo sistema de eventos
        await addHistoryEvent('testing', `Activación de testeo: ${statusLabel}`, `${newTest.product_name} en ${newTest.platform}`);
        
        setNewTest({ product_id: '', product_name: '', product_sku: '', platform: '', status: 'test_new' });
        setTestOpen(false);
    };

    const handleProductTestChange = (productId: string, productName: string, productSku: string) => {
        setNewTest({
            ...newTest,
            product_id: productId,
            product_name: productName,
            product_sku: productSku,
        });
    };

    const formatDate = (date: any) => {
        if (!date) return 'No especificado';
        if (typeof date === 'string') return new Date(date).toLocaleDateString('es-CO');
        if (date.toDate) return date.toDate().toLocaleDateString('es-CO');
        return String(date);
    };

    if (loading) return <div className="p-8 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
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
                            {client.status?.toUpperCase()}
                        </Badge>
                        <span>• {client.category}</span>
                        {client.assigned_commercial_name && (
                            <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {client.assigned_commercial_name}
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <div className="ml-auto">
                    <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Edit className="mr-2 h-4 w-4" /> Editar
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Editar Cliente</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Nombre</Label>
                                    <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Email</Label>
                                    <Input value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Teléfono</Label>
                                    <Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Ciudad</Label>
                                    <Input value={editForm.city} onChange={e => setEditForm({...editForm, city: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label>Categoría</Label>
                                        <Select value={editForm.category} onValueChange={v => setEditForm({...editForm, category: v as ClientCategory})}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="laboratorio">Laboratorio</SelectItem>
                                                <SelectItem value="chino">Chino</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Tipo</Label>
                                        <Select value={editForm.type} onValueChange={v => setEditForm({...editForm, type: v as ClientType})}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="dropshipper">Dropshipper</SelectItem>
                                                <SelectItem value="mixto">Mixto</SelectItem>
                                                <SelectItem value="ecommerce">Ecommerce</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Estado</Label>
                                    <Select value={editForm.status} onValueChange={v => setEditForm({...editForm, status: v as ClientStatus})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="finding_winner">Encontrando Winner</SelectItem>
                                            <SelectItem value="testing">Testeando</SelectItem>
                                            <SelectItem value="selling">Vendiendo</SelectItem>
                                            <SelectItem value="scaling">Escalando</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Notas</Label>
                                    <Textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSaveEdit} disabled={saving}>
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Datos de Contacto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{client.email || 'No especificado'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{client.phone || 'No especificado'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{client.city || 'No especificado'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Cumpleaños: {formatDate(client.birthday)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>Comercial: {client.assigned_commercial_name || 'No asignado'}</span>
                        </div>
                        {client.avg_sales !== undefined && (
                            <div className="flex items-center gap-3 pt-4 border-t">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                <span className="font-bold text-lg">${client.avg_sales.toLocaleString()}</span>
                                <span className="text-xs text-muted-foreground">Ventas Promedio</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="md:col-span-2 space-y-6">
                    <Tabs defaultValue="activity">
                        <TabsList>
                            <TabsTrigger value="activity">Actividad</TabsTrigger>
                            <TabsTrigger value="notes">Notas</TabsTrigger>
                            <TabsTrigger value="orders">Pedidos</TabsTrigger>
                            <TabsTrigger value="testing">Testeos</TabsTrigger>
                        </TabsList>
                        <TabsContent value="activity" className="space-y-4 pt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Historial de Actividad</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {history.length === 0 ? (
                                        <p className="text-muted-foreground text-sm">No hay actividad registrada</p>
                                    ) : (
                                        <div className="relative pl-4 border-l-2 border-muted space-y-6">
                                            {history.map((event) => (
                                                <div key={event.id} className="relative">
                                                    <div className={`absolute -left-[21px] top-1 h-4 w-4 rounded-full ${
                                                        event.type === 'registered' ? 'bg-green-500' :
                                                        event.type === 'status_change' ? 'bg-blue-500' :
                                                        event.type === 'edit' ? 'bg-yellow-500' :
                                                        event.type === 'note' ? 'bg-purple-500' :
                                                        event.type === 'order' ? 'bg-orange-500' :
                                                        'bg-primary'
                                                    }`} />
                                                    <p className="font-medium">{event.description}</p>
                                                    {event.details && (
                                                        <p className="text-sm text-muted-foreground mt-1">{event.details}</p>
                                                    )}
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {event.created_by} • {formatDate(event.created_at)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="notes" className="pt-4">
                            <div className="flex justify-end mb-4">
                                <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Agregar Nota</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Nueva Nota</DialogTitle>
                                        </DialogHeader>
                                        <Textarea 
                                            placeholder="Escribe una nota..." 
                                            value={newNote}
                                            onChange={e => setNewNote(e.target.value)}
                                            className="min-h-[100px]"
                                        />
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancelar</Button>
                                            <Button onClick={handleAddNote}>Agregar</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <Card>
                                <CardContent className="pt-6 space-y-4">
                                    {notes.length === 0 ? (
                                        <p className="text-muted-foreground text-center py-4">Sin notas</p>
                                    ) : (
                                        notes.map(note => (
                                            <div key={note.id} className="border-b pb-3 last:border-0">
                                                <p className="text-sm">{note.content}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {note.created_by} • {formatDate(note.created_at)}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="orders" className="pt-4">
                            <div className="flex justify-end mb-4">
                                <Dialog open={orderOpen} onOpenChange={(open) => {
                                    setOrderOpen(open);
                                    if (!open) {
                                        setProductSearch('');
                                        setProductPage(0);
                                        setEditingPrice(false);
                                        setTempUnitPrice(0);
                                    }
                                }}>
                                    <DialogTrigger asChild>
                                        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Agregar Pedido</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[500px]">
                                        <DialogHeader>
                                            <DialogTitle>Nuevo Pedido</DialogTitle>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid gap-2">
                                                <Label>Producto</Label>
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        placeholder="Buscar producto..."
                                                        value={productSearch}
                                                        onChange={e => {
                                                            setProductSearch(e.target.value);
                                                            setProductPage(0);
                                                        }}
                                                        className="pl-8"
                                                    />
                                                </div>
                                                <div className="border rounded-md max-h-[200px] overflow-y-auto">
                                                    {paginatedProducts.length === 0 ? (
                                                        <div className="p-4 text-center text-muted-foreground text-sm">
                                                            No se encontraron productos
                                                        </div>
                                                    ) : (
                                                        paginatedProducts.map(product => (
                                                            <div
                                                                key={product.id}
                                                                onClick={() => {
                                                                    handleProductChange(product.id);
                                                                    setProductSearch('');
                                                                }}
                                                                className={`p-3 cursor-pointer hover:bg-muted border-b last:border-0 ${
                                                                    newOrder.product_id === product.id ? 'bg-primary/10' : ''
                                                                }`}
                                                            >
                                                                <p className="font-medium text-sm">{product.name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    ${(product.priceDropshipping || 0).toLocaleString()}
                                                                </p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                                {totalProductPages > 1 && (
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                                                        <span>
                                                            {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-6 text-xs"
                                                                onClick={() => setProductPage(p => Math.max(0, p - 1))}
                                                                disabled={productPage === 0}
                                                            >
                                                                Anterior
                                                            </Button>
                                                            <span className="px-2">
                                                                {productPage + 1} / {totalProductPages}
                                                            </span>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-6 text-xs"
                                                                onClick={() => setProductPage(p => Math.min(totalProductPages - 1, p + 1))}
                                                                disabled={productPage >= totalProductPages - 1}
                                                            >
                                                                Siguiente
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {newOrder.product_name && (
                                                <div className="grid gap-2">
                                                    <Label>Precio Unitario</Label>
                                                    {editingPrice ? (
                                                        <div className="flex items-center gap-2">
                                                            <Input 
                                                                type="number"
                                                                value={tempUnitPrice}
                                                                onChange={e => setTempUnitPrice(Number(e.target.value))}
                                                                className="w-32"
                                                                autoFocus
                                                            />
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => {
                                                                    setNewOrder(prev => ({
                                                                        ...prev,
                                                                        unit_price: tempUnitPrice,
                                                                        total: tempUnitPrice * prev.quantity
                                                                    }));
                                                                    setEditingPrice(false);
                                                                }}
                                                            >
                                                                ✓
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setTempUnitPrice(newOrder.unit_price);
                                                                    setEditingPrice(false);
                                                                }}
                                                            >
                                                                ✕
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <Input 
                                                                type="text"
                                                                value={`$${newOrder.unit_price.toLocaleString()}`}
                                                                disabled
                                                                className="w-32 bg-muted"
                                                            />
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setTempUnitPrice(newOrder.unit_price);
                                                                    setEditingPrice(true);
                                                                }}
                                                            >
                                                                Editar
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label>Cantidad</Label>
                                                    <Input 
                                                        type="number" 
                                                        min="1"
                                                        value={newOrder.quantity}
                                                        onChange={e => handleQuantityChange(Number(e.target.value))}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Total</Label>
                                                    <Input 
                                                        type="text"
                                                        value={`$${newOrder.total.toLocaleString()}`}
                                                        disabled
                                                        className="bg-muted font-bold"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Comprobante de Pago (Opcional)</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        type="file"
                                                        accept="image/*,.pdf"
                                                        onChange={handlePaymentProof}
                                                        className="hidden"
                                                        id="payment-proof"
                                                    />
                                                    <Button 
                                                        type="button" 
                                                        variant="outline" 
                                                        onClick={() => document.getElementById('payment-proof')?.click()}
                                                        className="w-full"
                                                    >
                                                        <Upload className="mr-2 h-4 w-4" />
                                                        {newOrder.payment_proof || 'Subir comprobante'}
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {newOrder.payment_proof 
                                                        ? 'Comprobante cargado - El pedido quedará como "Pendiente"' 
                                                        : 'Sin comprobante - El pedido quedará como "Cotización"'}
                                                </p>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => {
                                                setNewOrder({ product_id: '', product_name: '', unit_price: 0, quantity: 1, total: 0, payment_proof: '' });
                                                setProductSearch('');
                                                setProductPage(0);
                                                setOrderOpen(false);
                                            }}>Cancelar</Button>
                                            <Button onClick={handleAddOrder} disabled={!newOrder.product_id}>
                                                Agregar Pedido
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <Card>
                                <CardContent className="pt-6">
                                    {orders.length === 0 ? (
                                        <p className="text-muted-foreground text-center py-4">Sin pedidos</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {orders.map(order => (
                                                <div key={order.id} className="border rounded-lg p-4 space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-medium">{order.product_name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {order.quantity} x ${order.unit_price.toLocaleString()} • {formatDate(order.created_at)}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-bold text-lg">${order.total.toLocaleString()}</p>
                                                            <Badge 
                                                                variant={order.status === 'quotation' ? 'secondary' : order.status === 'pending' ? 'outline' : 'default'}
                                                                className="text-xs"
                                                            >
                                                                {order.status === 'quotation' ? 'Cotización' : order.status === 'pending' ? 'Pendiente' : 'Pagado'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    {order.payment_proof && (
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <FileText className="h-3 w-3" />
                                                            <span>{order.payment_proof}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                             </Card>
                        </TabsContent>
                        <TabsContent value="testing" className="pt-4">
                            <div className="flex justify-end mb-4">
                                <Dialog open={testOpen} onOpenChange={(open) => {
                                    setTestOpen(open);
                                    if (!open) {
                                        setProductSearch('');
                                        setProductPage(0);
                                    }
                                }}>
                                    <DialogTrigger asChild>
                                        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Solicitar Testeo</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[500px]">
                                        <DialogHeader>
                                            <DialogTitle>Solicitar Activación de Testeo</DialogTitle>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid gap-2">
                                                <Label>Producto</Label>
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        placeholder="Buscar producto..."
                                                        value={productSearch}
                                                        onChange={e => {
                                                            setProductSearch(e.target.value);
                                                            setProductPage(0);
                                                        }}
                                                        className="pl-8"
                                                    />
                                                </div>
                                                <div className="border rounded-md max-h-[200px] overflow-y-auto">
                                                    {paginatedProducts.length === 0 ? (
                                                        <div className="p-4 text-center text-muted-foreground text-sm">
                                                            No se encontraron productos
                                                        </div>
                                                    ) : (
                                                        paginatedProducts.map(product => (
                                                            <div
                                                                key={product.id}
                                                                onClick={() => {
                                                                    handleProductTestChange(product.id, product.name, product.sku || '');
                                                                    setProductSearch('');
                                                                }}
                                                                className={`p-3 cursor-pointer hover:bg-muted border-b last:border-0 ${
                                                                    newTest.product_id === product.id ? 'bg-primary/10' : ''
                                                                }`}
                                                            >
                                                                <p className="font-medium text-sm">{product.name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {product.sku}
                                                                </p>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                                {Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE) > 1 && (
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                                                        <span>
                                                            {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-6 text-xs"
                                                                onClick={() => setProductPage(p => Math.max(0, p - 1))}
                                                                disabled={productPage === 0}
                                                            >
                                                                Anterior
                                                            </Button>
                                                            <span className="px-2">
                                                                {productPage + 1} / {Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)}
                                                            </span>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-6 text-xs"
                                                                onClick={() => setProductPage(p => Math.min(Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE) - 1, p + 1))}
                                                                disabled={productPage >= Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE) - 1}
                                                            >
                                                                Siguiente
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Plataforma</Label>
                                                <Input 
                                                    placeholder="Ej: TikTok, Instagram, Facebook..."
                                                    value={newTest.platform}
                                                    onChange={e => setNewTest({...newTest, platform: e.target.value})}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Estado</Label>
                                                <Select 
                                                    value={newTest.status}
                                                    onValueChange={(v: 'test_new' | 'active') => setNewTest({...newTest, status: v})}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="test_new">Testeo Nuevo</SelectItem>
                                                        <SelectItem value="active">Ya Activo</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => {
                                                setNewTest({ product_id: '', product_name: '', product_sku: '', platform: '', status: 'test_new' });
                                                setProductSearch('');
                                                setTestOpen(false);
                                            }}>
                                                Cancelar
                                            </Button>
                                            <Button 
                                                onClick={handleAddTest}
                                                disabled={!newTest.product_id || !newTest.platform.trim()}
                                            >
                                                Solicitar Testeo
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <Card>
                                <CardContent className="pt-6">
                                    {tests.length === 0 ? (
                                        <p className="text-muted-foreground text-center py-4">Sin testeos registrados</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {tests.map(test => (
                                                <div key={test.id} className="border rounded-lg p-4 space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-medium">{test.productName}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {test.platform} • {formatDate(test.created_at)}
                                                            </p>
                                                        </div>
                                                        <Badge 
                                                            variant={test.status === 'active' ? 'default' : 'secondary'}
                                                            className="text-xs"
                                                        >
                                                            {test.status === 'active' ? 'Ya Activo' : 'Testeo Nuevo'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
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
