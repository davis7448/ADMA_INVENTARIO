"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { User } from '@/lib/types';

interface TableroResultadosContentProps {
    comerciales: User[];
    currentUser: User | null;
}

export function TableroResultadosContent({ comerciales, currentUser }: TableroResultadosContentProps) {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Tablero de Resultados</h1>
                <p className="text-muted-foreground">Vista general del rendimiento de los comerciales.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {comerciales.map((comercial) => (
                    <Card key={comercial.id} className="overflow-hidden">
                        <CardHeader className="pb-4">
                            <div className="text-center">
                                <CardTitle className="text-lg">{comercial.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{comercial.email}</p>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium">Salario</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        ${comercial.salary?.toLocaleString() || 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Comisión</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {comercial.commissionPercentage ? `${comercial.commissionPercentage}%` : 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                                <img
                                    src={comercial.avatarUrl}
                                    alt={comercial.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling!.classList.remove('hidden');
                                    }}
                                />
                                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-500 hidden">
                                    {comercial.name.split(' ').map(n => n[0]).join('')}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-semibold">KPIs</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-muted-foreground">Comercios Activos</p>
                                        <p className="font-medium">0 / {comercial.activeBusinessesTarget || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Testeos Enviados</p>
                                        <p className="font-medium">0</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Contactos Diarios</p>
                                        <p className="font-medium">0</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Facturación</p>
                                        <p className="font-medium">{'$' + (comercial.billing?.toLocaleString() || '0')}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <h4 className="font-semibold mb-2">Distribución de Facturación</h4>
                                <p className="text-sm text-muted-foreground">Próximamente...</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}