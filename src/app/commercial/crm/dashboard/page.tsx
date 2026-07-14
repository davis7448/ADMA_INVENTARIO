"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, Upload, LayoutGrid, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommercialClient } from '@/types/commercial';
import { getAllClients, getClientsByCommercial, updateClient } from '@/lib/commercial-api';
import { useAuth } from '@/hooks/use-auth';
import { DropResult } from '@hello-pangea/dnd';
import CrmKanbanBoard from '@/components/commercial/crm-kanban-board';
import CrmMetricsView from '@/components/commercial/crm-metrics-view';

export default function CrmDashboardPage() {
    const { user } = useAuth();
    const [clients, setClients] = useState<CommercialClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const isDirector = user?.role === 'commercial_director' || user?.role === 'admin';

    useEffect(() => {
        async function loadClients() {
            if (!user) return;
            try {
                const data = isDirector ? await getAllClients(user.role, user.id) : await getClientsByCommercial(user.id);
                setClients(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadClients();
    }, [user, isDirector]);

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
        } catch (error) {
            console.error('Error updating client status:', error);
            setClients(prev => prev.map(c =>
                c.id === clientId ? { ...c, status: client.status } : c
            ));
        }
    };

    const filteredClients = useMemo(() => {
        if (!search.trim()) return clients;
        const q = search.toLowerCase();
        return clients.filter(c =>
            c.name?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q)
        );
    }, [clients, search]);

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
                        <Button variant="outline" size="icon">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>

                    <CrmKanbanBoard clients={filteredClients} onDragEnd={onDragEnd} />
                </TabsContent>

                <TabsContent value="metrics">
                    <CrmMetricsView clients={clients} isDirector={isDirector} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
