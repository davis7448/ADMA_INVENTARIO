"use client";

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Users, DollarSign, Star, TrendingUp } from 'lucide-react';
import { ChallengeCard } from '@/components/commercial/challenge-card';
import { useEffect, useState } from 'react';
import { getActiveChallenges } from '@/lib/commercial-api';
import { getUsers } from '@/lib/api';
import { CommercialChallenge } from '@/types/commercial';
import type { User } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function CommercialDashboardPage() {
    const { user } = useAuth();
    const [challenges, setChallenges] = useState<CommercialChallenge[]>([]);
    const [commercials, setCommercials] = useState<User[]>([]);
    const [loadingCommercials, setLoadingCommercials] = useState(true);

    useEffect(() => {
        if (user) {
            // Auto-run migration
            import('@/lib/commercial-api').then(({ fixUserProfile, getActiveChallenges }) => {
                fixUserProfile(user);
                getActiveChallenges('daily').then(setChallenges);
            });

            // Load real commercials
            getUsers().then(users => {
                const commercialUsers = users.filter(u => 
                    u.role === 'commercial' || u.role === 'commercial_director'
                );
                setCommercials(commercialUsers);
                setLoadingCommercials(false);
            });
        }
    }, [user]);

    const isDirector = user?.role === 'commercial_director' || user?.role === 'admin';

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {isDirector ? 'Tablero General (Director)' : `Hola, ${user?.name?.split(' ')[0] || 'Comercial'}!`}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {isDirector
                            ? 'Monitoreo de rendimiento global y gestión de equipo.'
                            : 'Aquí está el resumen de tu rendimiento hoy.'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Date filter or actions could go here */}
                </div>
            </div>

            {/* STATS ROW - Placeholder for future implementation */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {isDirector ? 'Total Clientes Activos' : 'Mis Clientes Activos'}
                        </CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">-</div>
                        <p className="text-xs text-muted-foreground">
                            En construcción
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Ventas Mes Actual
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">-</div>
                        <p className="text-xs text-muted-foreground">
                            En construcción
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-600/10 border-purple-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Tasa de Cierre
                        </CardTitle>
                        <Activity className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">-</div>
                        <p className="text-xs text-muted-foreground">
                            En construcción
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border-amber-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Calificación Promedio
                        </CardTitle>
                        <Star className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-muted-foreground">-</div>
                        <p className="text-xs text-muted-foreground">
                            En construcción
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* ACTIVE CHALLENGES */}
                <Card className="col-span-4 border-none shadow-none bg-transparent">
                    <CardHeader className="px-0">
                        <CardTitle>Retos Activos</CardTitle>
                    </CardHeader>
                    <div className="space-y-4">
                        {challenges.length > 0 ? (
                            challenges.map(challenge => (
                                <ChallengeCard key={challenge.id} challenge={challenge} />
                            ))
                        ) : (
                            <Card className="p-6 border-dashed">
                                <div className="text-center text-muted-foreground">No hay retos activos hoy.</div>
                            </Card>
                        )}
                    </div>
                </Card>

                {/* TOP COMMERCIALS - REAL DATA */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Equipo Comercial</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingCommercials ? (
                            <div className="text-center text-muted-foreground py-8">
                                Cargando equipo...
                            </div>
                        ) : commercials.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                No hay comerciales registrados
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {commercials.slice(0, 5).map((commercial, index) => (
                                    <div className="flex items-center" key={commercial.id}>
                                        <div className="h-9 w-9 rounded-full bg-muted border flex items-center justify-center font-bold text-muted-foreground">
                                            {index + 1}
                                        </div>
                                        <Avatar className="h-9 w-9 ml-2">
                                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                                {commercial.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'C'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="ml-3 space-y-1">
                                            <p className="text-sm font-medium leading-none">{commercial.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {commercial.email}
                                            </p>
                                        </div>
                                        <div className="ml-auto text-xs text-muted-foreground">
                                            {commercial.role === 'commercial_director' ? 'Director' : 'Comercial'}
                                        </div>
                                    </div>
                                ))}
                                {commercials.length > 5 && (
                                    <p className="text-center text-xs text-muted-foreground pt-2">
                                        +{commercials.length - 5} comerciales más
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
