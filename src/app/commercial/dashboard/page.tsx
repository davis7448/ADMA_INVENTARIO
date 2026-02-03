"use client";

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Users, DollarSign, Star, TrendingUp } from 'lucide-react';
import { ChallengeCard } from '@/components/commercial/challenge-card';
import { useEffect, useState } from 'react';
import { getActiveChallenges } from '@/lib/commercial-api';
import { CommercialChallenge } from '@/types/commercial';

export default function CommercialDashboardPage() {
    const { user } = useAuth();
    const [challenges, setChallenges] = useState<CommercialChallenge[]>([]);

    useEffect(() => {
        if (user) {
            // Auto-run migration
            import('@/lib/commercial-api').then(({ fixUserProfile, getActiveChallenges }) => {
                fixUserProfile(user);
                getActiveChallenges('daily').then(setChallenges);
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

            {/* STATS ROW */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {isDirector ? 'Total Clientes Activos' : 'Mis Clientes Activos'}
                        </CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1,240</div>
                        <p className="text-xs text-muted-foreground">
                            +180 desde el mes pasado
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
                        <div className="text-2xl font-bold">$45.2M</div>
                        <p className="text-xs text-muted-foreground">
                            +12% vs mes anterior
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
                        <div className="text-2xl font-bold">24.5%</div>
                        <p className="text-xs text-muted-foreground">
                            -2% vs semana pasada
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
                        <div className="text-2xl font-bold">4.8</div>
                        <p className="text-xs text-muted-foreground">
                            Basado en 42 calificaciones
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
                        {/* Placeholder mock challenge if none exist yet */}
                        {challenges.length === 0 && (
                            <ChallengeCard challenge={{
                                title: "Vende 3 Productos 'Winner' Hoy",
                                description: "Logra vender 3 unidades de cualquier producto catalogado como 'Winner' para desbloquear bonificación.",
                                type: 'daily',
                                reward: '50 Estrellas',
                                is_active: true, // Should be true, but type mismatch fix
                                created_by: 'system',
                                created_at: new Date()
                            }} />
                        )}
                    </div>
                </Card>

                {/* LEADERBOARD / ACTIVITY */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Top Comerciales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div className="flex items-center" key={i}>
                                    <div className="h-9 w-9 rounded-full bg-muted border flex items-center justify-center font-bold text-muted-foreground">
                                        {i}
                                    </div>
                                    <div className="ml-4 space-y-1">
                                        <p className="text-sm font-medium leading-none">Comercial {i}</p>
                                        <p className="text-xs text-muted-foreground">
                                            $15,000,000 en ventas
                                        </p>
                                    </div>
                                    <div className="ml-auto font-medium text-green-600">
                                        +{Math.floor(Math.random() * 50)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
