"use client";

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
    sincronizarCotizacionClickUp, adjuntosCotizacion, subirAdjuntosCotizacion,
    observacionesCotizacion, agregarObservacionCotizacion,
} from '@/app/actions/cotizaciones';
import type { ClickUpAttachment } from '@/lib/clickup';
import type { Observacion } from '@/lib/clickup-cotizaciones';
import { ExternalLink, Loader2, Paperclip, Send, Upload } from 'lucide-react';

// Anexos y observaciones de la negociación de una cotización.
//
// Ambos viven en la tarea de ClickUp, no en ADMA: es donde el equipo ya trabaja y donde
// los adjuntos tienen control de acceso real. Aquí se leen en vivo y se escriben a través
// del servidor, que es quien tiene el token — los comerciales no tienen permiso de
// edición en ClickUp.
export function CotizacionClickUpPanel({ cotizacionId, taskId, url, actor, onSincronizada }: {
    cotizacionId: string;
    taskId?: string;
    url?: string;
    // Quién escribe. El token de ClickUp es el de ADMA, así que sin esto todas las
    // observaciones quedarían atribuidas a la misma cuenta.
    actor: string;
    onSincronizada: () => void;
}) {
    const { toast } = useToast();
    const [sincronizando, setSincronizando] = useState(false);
    const [adjuntos, setAdjuntos] = useState<ClickUpAttachment[]>([]);
    const [observaciones, setObservaciones] = useState<Observacion[]>([]);
    const [cargando, setCargando] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
        if (!taskId) return;
        setCargando(true);
        const [a, o] = await Promise.all([
            adjuntosCotizacion(cotizacionId),
            observacionesCotizacion(cotizacionId),
        ]);
        if (a.success) setAdjuntos(a.adjuntos || []);
        if (o.success) setObservaciones(o.observaciones || []);
        setCargando(false);
    }, [cotizacionId, taskId]);

    useEffect(() => { cargar(); }, [cargar]);

    const sincronizar = async () => {
        setSincronizando(true);
        const r = await sincronizarCotizacionClickUp(cotizacionId);
        setSincronizando(false);
        if (r.success) {
            toast({ title: 'Enviada a ClickUp', description: 'Se creó la tarea con sus cinco etapas.' });
            onSincronizada();
        } else {
            toast({ title: 'No se pudo enviar', description: r.error, variant: 'destructive' });
        }
    };

    if (!taskId) {
        return (
            <div className="border-t pt-3 space-y-2">
                <Label className="text-sm">ClickUp</Label>
                <p className="text-xs text-muted-foreground">
                    Todavía no tiene tarea. Al enviarla se crea en la lista <em>Cotizaciones</em> con
                    las etapas de Cotizar envase, Formulación, Diseño de etiqueta, Cotización de
                    etiqueta y Costo de fabricación.
                </p>
                <Button size="sm" disabled={sincronizando} onClick={sincronizar}>
                    {sincronizando ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Send className="mr-2 h-3 w-3" />}
                    Enviar a ClickUp
                </Button>
            </div>
        );
    }

    return (
        <>
            <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-sm">Anexos</Label>
                    {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
                            Abrir en ClickUp <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>

                {cargando && <p className="text-xs text-muted-foreground">Cargando…</p>}
                {!cargando && !adjuntos.length && (
                    <p className="text-xs text-muted-foreground">
                        Sin anexos todavía. Aquí van etiquetas, fichas técnicas, referencias de envase
                        o lo que se vaya generando.
                    </p>
                )}
                <div className="space-y-1">
                    {adjuntos.map(a => (
                        <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm hover:bg-muted/50">
                            {a.isImage && a.thumbnailUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={a.thumbnailUrl} alt={a.title} className="h-8 w-8 rounded object-cover" />
                                : <Paperclip className="h-4 w-4 text-muted-foreground" />}
                            <span className="truncate">{a.title}</span>
                        </a>
                    ))}
                </div>

                <div className="flex gap-2">
                    <Input type="file" multiple className="h-9 text-xs" disabled={subiendo}
                        onChange={async e => {
                            const archivos = Array.from(e.target.files || []);
                            if (!archivos.length) return;
                            setSubiendo(true);
                            const fd = new FormData();
                            for (const f of archivos) fd.append('archivos', f);
                            const r = await subirAdjuntosCotizacion(cotizacionId, fd);
                            setSubiendo(false);
                            e.target.value = '';
                            if (r.success) {
                                toast({ title: 'Anexado', description: `${r.subidos} archivo(s) en la tarea.` });
                                cargar();
                            } else {
                                // Puede haber subido algunos y fallado otros: se dice cuántos entraron.
                                toast({
                                    title: 'Algunos archivos no subieron',
                                    description: `${r.subidos ?? 0} subido(s). ${r.error || ''}`.trim(),
                                    variant: 'destructive',
                                });
                                cargar();
                            }
                        }} />
                    {subiendo && <Loader2 className="h-4 w-4 animate-spin self-center" />}
                    {!subiendo && <Upload className="h-4 w-4 self-center text-muted-foreground" />}
                </div>
            </div>

            <div className="border-t pt-3 space-y-2">
                <Label className="text-sm">Observaciones de la negociación</Label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {observaciones.map(o => (
                        <div key={o.id} className="rounded-md border px-2 py-1.5 text-sm">
                            <p className="whitespace-pre-wrap">{o.texto}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {o.autor} · {new Date(o.fecha).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    ))}
                    {!cargando && !observaciones.length && (
                        <p className="text-xs text-muted-foreground">Sin observaciones todavía.</p>
                    )}
                </div>
                <Textarea rows={2} placeholder="Qué se habló con el cliente, qué quedó pendiente…"
                    value={texto} onChange={e => setTexto(e.target.value)} className="text-sm" />
                <Button size="sm" variant="outline" disabled={enviando || !texto.trim()} onClick={async () => {
                    setEnviando(true);
                    const r = await agregarObservacionCotizacion(cotizacionId, texto, actor);
                    setEnviando(false);
                    if (r.success) { setTexto(''); cargar(); }
                    else toast({ title: 'No se pudo guardar', description: r.error, variant: 'destructive' });
                }}>
                    {enviando && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Añadir observación
                </Button>
            </div>
        </>
    );
}
