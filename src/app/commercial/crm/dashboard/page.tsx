"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, Upload, LayoutGrid, BarChart3, Megaphone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CommercialClient } from '@/types/commercial';
import { getAllClients, updateClient, addClientEvent } from '@/lib/commercial-api';
import { etiquetaPais } from '@/lib/paises';
import { useAuth } from '@/hooks/use-auth';
import { DropResult } from '@hello-pangea/dnd';
import CrmKanbanBoard from '@/components/commercial/crm-kanban-board';
import CrmMetricsView from '@/components/commercial/crm-metrics-view';
import { DifusionContent } from '@/components/commercial/difusion-content';
import { FollowUpAlerts } from '@/components/commercial/followup-alerts';

// Nombres legibles de las columnas del tablero (para el historial del cliente)
const ETIQUETA_ESTADO: Record<string, string> = {
    finding_winner: 'Buscando Ganador',
    testing: 'Testeando',
    selling: 'Vendiendo',
    scaling: 'Escalando',
};

export default function CrmDashboardPage() {
    const { user } = useAuth();
    const [clients, setClients] = useState<CommercialClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    // Filtros del tablero: dueño de la cartera y país del cliente
    const [verSolo, setVerSolo] = useState<'todos' | 'mios'>('todos');
    const [paisFiltro, setPaisFiltro] = useState<string>('todos');

    const isDirector = user?.role === 'commercial_director' || user?.role === 'admin';

    useEffect(() => {
        async function loadClients() {
            if (!user) return;
            try {
                // Cartera compartida: todos los comerciales ven todos los clientes.
                // La tarjeta indica a quién pertenece cada uno.
                const data = await getAllClients(user.role, user.id);
                setClients(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadClients();
    }, [user]);

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const clientId = draggableId;
        const newStatus = destination.droppableId;

        const client = clients.find(c => c.id === clientId);
        if (!client || client.status === newStatus) return;

        setClients(prev => prev.map(c =>
            c.id === clientId ? { ...c, status: newStatus as CommercialClient['status'] } : c
        ));

        try {
            await updateClient(clientId, { status: newStatus as CommercialClient['status'] });
            // Queda registrado QUIÉN movió al cliente, aunque sea de otro comercial.
            if (user) {
                await addClientEvent(
                    clientId, 'status_change',
                    `Movió el cliente de "${ETIQUETA_ESTADO[client.status] || client.status}" a "${ETIQUETA_ESTADO[newStatus] || newStatus}"`,
                    user.id, user.name,
                ).catch(e => console.error('No se pudo registrar el cambio de estado:', e));
            }
        } catch (error) {
            console.error('Error updating client status:', error);
            setClients(prev => prev.map(c =>
                c.id === clientId ? { ...c, status: client.status } : c
            ));
        }
    };

    const filteredClients = useMemo(() => {
        const q = search.trim().toLowerCase();
        return clients.filter(c => {
            if (verSolo === 'mios' && c.assigned_commercial_id !== user?.id) return false;
            if (paisFiltro !== 'todos' && (c.country || '') !== paisFiltro) return false;
            if (!q) return true;
            return c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
        });
    }, [clients, search, verSolo, paisFiltro, user?.id]);

    // Países presentes en la cartera (para no ofrecer filtros vacíos)
    const paisesEnCartera = useMemo(
        () => Array.from(new Set(clients.map(c => c.country).filter(Boolean))).sort() as string[],
        [clients]
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">CRM Clientes</h1>
                    <p className="text-muted-foreground">Gestiona el pipeline y analiza el rendimiento de tus clientes.</p>
                </div>
                <div className="flex gap-2">
                    {isDirector && (
                        <Link href="/commercial/crm/import">
                            <Button variant="outline">
                                <Upload className="mr-2 h-4 w-4" /> Importar Excel
                            </Button>
                        </Link>
                    )}
                    <Link href="/commercial/crm/register">
                        <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:scale-105">
                            <Plus className="mr-2 h-4 w-4" /> Registrar Cliente
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs defaultValue="board" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="board">
                        <LayoutGrid className="mr-2 h-4 w-4" /> Tablero
                    </TabsTrigger>
                    <TabsTrigger value="metrics">
                        <BarChart3 className="mr-2 h-4 w-4" /> Métricas
                    </TabsTrigger>
                    <TabsTrigger value="difusion">
                        <Megaphone className="mr-2 h-4 w-4" /> Difusión
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="board" className="space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Buscar cliente..."
                                className="pl-8 bg-background/50 backdrop-blur-sm"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        {/* Cartera compartida: por defecto se ven todos los clientes */}
                        <Select value={verSolo} onValueChange={v => setVerSolo(v as 'todos' | 'mios')}>
                            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos los clientes</SelectItem>
                                <SelectItem value="mios">Solo mis clientes</SelectItem>
                            </SelectContent>
                        </Select>
                        {paisesEnCartera.length > 0 && (
                            <Select value={paisFiltro} onValueChange={setPaisFiltro}>
                                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos los países</SelectItem>
                                    {paisesEnCartera.map(p => (
                                        <SelectItem key={p} value={p}>{etiquetaPais(p)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {filteredClients.length} de {clients.length}
                        </span>
                    </div>

                    <CrmKanbanBoard clients={filteredClients} onDragEnd={onDragEnd} />
                </TabsContent>

                <TabsContent value="metrics">
                    <CrmMetricsView clients={clients} isDirector={isDirector} />
                </TabsContent>

                <TabsContent value="difusion" className="space-y-4">
                    <FollowUpAlerts clients={clients} />
                    <DifusionContent />
                </TabsContent>
            </Tabs>
        </div>
    );
}
