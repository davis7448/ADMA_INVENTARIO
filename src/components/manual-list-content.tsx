"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, ChevronRight, Users, Truck } from 'lucide-react';
import { getGuias } from '@/lib/manual-api';
import type { ManualGuia } from '@/lib/manual-types';

const ICONO = { comercial: Users, logistica: Truck, general: BookOpen } as const;
const ETIQUETA = { comercial: 'Comercial', logistica: 'Logística', general: 'General' } as const;

export function ManualListContent() {
    const [guias, setGuias] = useState<ManualGuia[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getGuias()
            .then(setGuias)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const pasos = (g: ManualGuia) => (g.secciones || []).reduce((a, s) => a + (s.pasos?.length || 0), 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
                    <BookOpen className="h-7 w-7" /> Capacitación
                </h1>
                <p className="text-muted-foreground">
                    Manuales de uso de la plataforma: para qué sirve cada cosa, cómo se hace y en qué casos se usa.
                </p>
            </div>

            {loading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ) : guias.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Aún no hay guías publicadas.
                </CardContent></Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {guias.map(g => {
                        const Icon = ICONO[g.audiencia] || BookOpen;
                        return (
                            <Link key={g.slug} href={`/manual/${g.slug}`} className="group">
                                <Card className="h-full transition-colors hover:border-primary/60">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></span>
                                                <CardTitle className="text-base">{g.titulo}</CardTitle>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                        </div>
                                        <CardDescription className="pt-1">{g.descripcion}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-wrap items-center gap-2 pt-0">
                                        <Badge variant="secondary">{ETIQUETA[g.audiencia] || g.audiencia}</Badge>
                                        <Badge variant="outline">{(g.secciones || []).length} secciones</Badge>
                                        <Badge variant="outline">{pasos(g)} pasos</Badge>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
