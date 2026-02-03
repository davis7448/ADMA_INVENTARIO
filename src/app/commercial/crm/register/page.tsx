"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/commercial-api';
import { CommercialClient } from '@/types/commercial';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function RegisterClientPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [submitting, setSubmitting] = useState(false);

    // Simple state for form
    const [formData, setFormData] = useState<Partial<CommercialClient>>({
        name: '',
        email: '',
        phone: '',
        city: '',
        category: 'laboratorio',
        type: 'mixto',
        status: 'finding_winner',
        avg_sales: 0
    });

    const handleChange = (field: keyof CommercialClient, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmitting(true);
        try {
            await createClient({
                ...formData as CommercialClient,
                assigned_commercial_id: user.id,
                created_at: new Date(),
                birthday: new Date(formData.birthday || new Date())
            });
            toast({
                title: "Cliente registrado",
                description: "El cliente ha sido creado exitosamente.",
                variant: 'default'
            });
            router.push('/commercial/crm/dashboard');
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "No se pudo registrar el cliente.",
                variant: "destructive"
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <Link href="/commercial/crm/dashboard" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Tablero
            </Link>

            <Card>
                <CardHeader>
                    <CardTitle>Registrar Nuevo Cliente</CardTitle>
                    <CardDescription>Ingresa los datos básicos para iniciar el seguimiento.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre Completo</Label>
                                <Input
                                    id="name"
                                    required
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Celular</Label>
                                <Input
                                    id="phone"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city">Ciudad</Label>
                                <Input
                                    id="city"
                                    required
                                    value={formData.city}
                                    onChange={(e) => handleChange('city', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Categoría</Label>
                                <Select value={formData.category} onValueChange={(val) => handleChange('category', val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="laboratorio">Laboratorio</SelectItem>
                                        <SelectItem value="chino">Chino</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Tipo de Cliente</Label>
                                <Select value={formData.type} onValueChange={(val) => handleChange('type', val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dropshipper">Dropshipper</SelectItem>
                                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                                        <SelectItem value="mixto">Mixto</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="birthday">Fecha Cumpleaños</Label>
                                <Input
                                    id="birthday"
                                    type="date"
                                    onChange={(e) => handleChange('birthday', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="avg_sales">Ventas Promedio ($)</Label>
                                <Input
                                    id="avg_sales"
                                    type="number"
                                    value={formData.avg_sales}
                                    onChange={(e) => handleChange('avg_sales', Number(e.target.value))}
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Registrar Cliente
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
