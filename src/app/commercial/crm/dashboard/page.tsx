"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CommercialClient } from '@/types/commercial';
import { getAllClients, getClientsByCommercial } from '@/lib/commercial-api';
import { useAuth } from '@/hooks/use-auth';

// Helper for status colors
const getStatusColor = (status: string) => {
    switch (status) {
        case 'finding_winner': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        case 'testing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
        case 'selling': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        case 'scaling': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'finding_winner': return 'Encontrando Winner';
        case 'testing': return 'Testeando';
        case 'selling': return 'Vendiendo';
        case 'scaling': return 'Escalando';
        default: return status;
    }
}

export default function CrmDashboardPage() {
    const { user } = useAuth();
    const [clients, setClients] = useState<CommercialClient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadClients() {
            if (!user) return;
            try {
                // If director, fetch all. If commercial, fetch mine.
                const isDirector = user.role === 'commercial_director' || user.role === 'admin';
                const data = isDirector ? await getAllClients() : await getClientsByCommercial(user.id);
                setClients(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadClients();
    }, [user]);

    const columns = [
        { id: 'finding_winner', label: 'Encontrando Winner' },
        { id: 'testing', label: 'Testeando' },
        { id: 'selling', label: 'Vendiendo' },
        { id: 'scaling', label: 'Escalando' }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">CRM Clientes</h1>
                    <p className="text-muted-foreground">Gestiona y visualiza el estado de tus clientes en el pipeline.</p>
                </div>
                <Link href="/commercial/crm/register">
                    <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:scale-105">
                        <Plus className="mr-2 h-4 w-4" /> Registrar Cliente
                    </Button>
                </Link>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar cliente..."
                        className="pl-8 bg-background/50 backdrop-blur-sm"
                    />
                </div>
                <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[calc(100vh-250px)] overflow-x-auto">
                {columns.map(col => {
                    const colClients = clients.filter(c => c.status === col.id);
                    return (
                        <div key={col.id} className="flex flex-col gap-4 bg-muted/40 p-4 rounded-xl min-w-[280px]">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-sm uppercase text-muted-foreground">{col.label}</h3>
                                <Badge variant="secondary" className="rounded-full">{colClients.length}</Badge>
                            </div>

                            <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                                {colClients.map(client => (
                                    <Link key={client.id} href={`/commercial/crm/client/${client.id}`}>
                                        <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary/50">
                                            <CardContent className="p-4">
                                                <div className="font-bold text-base truncate">{client.name}</div>
                                                <div className="text-xs text-muted-foreground mb-2 truncate">{client.email}</div>

                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    <Badge variant="outline" className="text-[10px] h-5">{client.category}</Badge>
                                                    <Badge variant="outline" className="text-[10px] h-5">{client.type}</Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                                {colClients.length === 0 && (
                                    <div className="text-center text-xs text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                                        Sin clientes
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}
