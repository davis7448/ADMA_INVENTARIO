"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChallengeCard } from '@/components/commercial/challenge-card';
import { getActiveChallenges } from '@/lib/commercial-api';
import { CommercialChallenge } from '@/types/commercial';
import { Loader2 } from 'lucide-react';

export default function ChallengesPage() {
    const [dailyChallenges, setDailyChallenges] = useState<CommercialChallenge[]>([]);
    const [monthlyChallenges, setMonthlyChallenges] = useState<CommercialChallenge[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const daily = await getActiveChallenges('daily');
                const monthly = await getActiveChallenges('monthly');
                setDailyChallenges(daily);
                setMonthlyChallenges(monthly);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Retos y Misiones</h1>
                <p className="text-muted-foreground">Completa misiones diarias y mensuales para ganar premios y reconocimiento.</p>
            </div>

            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <h2 className="text-xl font-bold">Retos del Día</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {dailyChallenges.length > 0 ? dailyChallenges.map(c => (
                        <ChallengeCard key={c.id} challenge={c} />
                    )) : (
                        <div className="col-span-full p-8 border border-dashed rounded-lg text-center text-muted-foreground">
                            No hay retos diarios activos hoy.
                        </div>
                    )}
                </div>
            </section>

            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    <h2 className="text-xl font-bold">Misiones del Mes</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {monthlyChallenges.length > 0 ? monthlyChallenges.map(c => (
                        <ChallengeCard key={c.id} challenge={c} />
                    )) : (
                        <div className="col-span-full p-8 border border-dashed rounded-lg text-center text-muted-foreground">
                            No hay misiones mensuales activas.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
