"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertTriangle, HelpCircle } from 'lucide-react';
import { getGuia } from '@/lib/manual-api';
import type { ManualGuia, ManualPaso } from '@/lib/manual-types';

// Pantallazo con marcadores numerados encima (posición en % del ancho/alto).
function Pantallazo({ paso }: { paso: ManualPaso }) {
    if (!paso.imagenUrl) return null;
    return (
        <div className="mt-3">
            <div className="relative inline-block max-w-full overflow-hidden rounded-lg border bg-muted/30">
                <img src={paso.imagenUrl} alt={paso.titulo} className="block max-w-full h-auto" />
                {(paso.anotaciones || []).filter(a => a.x !== undefined && a.y !== undefined).map(a => (
                    <span
                        key={a.numero}
                        className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white ring-2 ring-white shadow"
                        style={{ left: `${a.x}%`, top: `${a.y}%` }}
                    >
                        {a.numero}
                    </span>
                ))}
            </div>
            {(paso.anotaciones || []).length > 0 && (
                <ol className="mt-3 space-y-1.5">
                    {(paso.anotaciones || []).map(a => (
                        <li key={a.numero} className="flex gap-2 text-sm">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">{a.numero}</span>
                            <span>{a.texto}</span>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

export function ManualGuideContent() {
    const params = useParams();
    const slug = String(params?.slug || '');
    const [guia, setGuia] = useState<ManualGuia | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;
        getGuia(slug).then(setGuia).catch(console.error).finally(() => setLoading(false));
    }, [slug]);

    if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 w-full" /></div>;
    if (!guia) return (
        <Card><CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No se encontró la guía.</p>
            <Button asChild variant="outline" className="mt-4"><Link href="/manual">Volver</Link></Button>
        </CardContent></Card>
    );

    let n = 0; // numeración continua de pasos
    return (
        <div className="space-y-6">
            <div>
                <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
                    <Link href="/manual"><ArrowLeft className="mr-1 h-4 w-4" /> Capacitación</Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline tracking-tight">{guia.titulo}</h1>
                <p className="text-muted-foreground">{guia.descripcion}</p>
            </div>

            {/* Índice */}
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Contenido</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    {(guia.secciones || []).map((s, i) => (
                        <a key={i} href={`#sec-${i}`}>
                            <Badge variant="outline" className="cursor-pointer hover:bg-accent">{i + 1}. {s.titulo}</Badge>
                        </a>
                    ))}
                </CardContent>
            </Card>

            {(guia.secciones || []).map((sec, i) => (
                <Card key={i} id={`sec-${i}`} className="scroll-mt-4">
                    <CardHeader>
                        <CardTitle className="text-lg">{i + 1}. {sec.titulo}</CardTitle>
                        {sec.descripcion && <CardDescription>{sec.descripcion}</CardDescription>}
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {(sec.pasos || []).map((paso, j) => {
                            n++;
                            return (
                                <div key={j} className="border-l-2 border-primary/30 pl-4">
                                    <h3 className="flex items-center gap-2 font-semibold">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
                                        {paso.titulo}
                                    </h3>
                                    <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">{paso.explicacion}</p>

                                    {paso.cuandoUsar && (
                                        <div className="mt-2 flex gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-2.5 text-sm">
                                            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                            <span><b>Cuándo se usa:</b> {paso.cuandoUsar}</span>
                                        </div>
                                    )}
                                    {paso.ojo && (
                                        <div className="mt-2 flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 text-sm">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                            <span><b>Ojo:</b> {paso.ojo}</span>
                                        </div>
                                    )}
                                    <Pantallazo paso={paso} />
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
