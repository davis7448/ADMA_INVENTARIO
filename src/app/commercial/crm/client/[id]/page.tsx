"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, Phone, Mail, MapPin, Calendar, DollarSign, Activity } from 'lucide-react';
import Link from 'next/link';

// Mock data fetcher since we don't have a direct 'getClientById' server action exposed in this snippet context
// In real app, we would add `getClientById` to commercial-api.ts
const mockClient = {
    id: '1',
    name: 'Farmacia San Juan',
    email: 'contacto@sanjuan.com',
    phone: '+57 300 123 4567',
    city: 'Bogotá',
    category: 'Laboratorio',
    type: 'Mixto',
    status: 'selling',
    avg_sales: 1500,
    birthday: '1990-05-15',
    notes: 'Cliente muy interesado en productos de alta rotación. Se le envió catálogo ayer.'
};

export default function ClientDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [client, setClient] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate fetch
        setTimeout(() => {
            setClient({ ...mockClient, id: params.id });
            setLoading(false);
        }, 500);
    }, [params.id]);

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
                    <Button variant="outline">
                        <Edit className="mr-2 h-4 w-4" /> Editar
                    </Button>
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
                            <span>Cumpleaños: {client.birthday}</span>
                        </div>
                        <div className="flex items-center gap-3 pt-4 border-t">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="font-bold text-lg">${client.avg_sales.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground">Ventas Promedio</span>
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 space-y-6">
                    <Tabs defaultValue="activity">
                        <TabsList>
                            <TabsTrigger value="activity">Actividad</TabsTrigger>
                            <TabsTrigger value="notes">Notas</TabsTrigger>
                            <TabsTrigger value="orders">Pedidos</TabsTrigger>
                        </TabsList>
                        <TabsContent value="activity" className="space-y-4 pt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Historial Reciente</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="relative pl-4 border-l-2 border-muted space-y-6">
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-1 h-4 w-4 rounded-full bg-primary" />
                                            <p className="font-medium">Cambio de estado a "Selling"</p>
                                            <p className="text-sm text-muted-foreground">Hoy, 10:00 AM</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-1 h-4 w-4 rounded-full bg-muted-foreground" />
                                            <p className="font-medium">Cliente registrado</p>
                                            <p className="text-sm text-muted-foreground">Ayer, 4:30 PM</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="notes" className="pt-4">
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="italic text-muted-foreground">"{client.notes}"</p>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="orders" className="pt-4">
                            <div className="text-center p-8 text-muted-foreground">
                                No hay pedidos registrados aún.
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
