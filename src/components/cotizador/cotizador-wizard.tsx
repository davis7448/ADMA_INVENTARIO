"use client";

// Formulario de cotización de maquila.
//
// Diferencias deliberadas con la referencia auditada, que era un prototipo de navegador:
//  · Al cambiar de categoría se limpian los campos que ya no aplican, en vez de quedar
//    escondidos y viajar en el resumen.
//  · El progreso declara 6 pasos + confirmación, sin prometer 7 y mostrar 6.
//  · Los ingredientes se normalizan y no se repiten.
//  · La confirmación solo aparece después de que el servidor responde, y muestra el
//    consecutivo que él asignó. Nunca se dice "recibido" antes de que lo esté.
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
    CANALES_VENTA, CANTIDAD, CATEGORIAS, CATEGORIAS_CON_TABLA_NUTRICIONAL, FORMAS, FRAGANCIAS,
    INCLUIDOS_FULL, APORTES_CLIENTE, MODALIDADES, ORIGENES_LEAD, PAISES, RUTAS_FORMULACION,
    RUTAS_REGULATORIAS, type CategoriaId,
} from '@/lib/cotizador-catalogo';
import { normalizarIngrediente, type CotizacionInput } from '@/lib/cotizador-schema';
import { crearCotizacion, subirReferenciasCotizacion } from '@/app/actions/cotizador';
import { CheckCircle2, Loader2 } from 'lucide-react';

const PASOS = ['Categoría', 'Forma', 'Maquila', 'Formulación', 'Detalles', 'Contacto'];

const INICIAL: Partial<CotizacionInput> = {
    formas: [], incluidos: ['Envase', 'Etiqueta'], aportaCliente: [],
    ingredientesIncluir: [], ingredientesEvitar: [], canalesVenta: ['Ecommerce'],
    cantidad: CANTIDAD.inicial, esAerosol: false, solicitaMejora: false,
    confidencialidad: true, pilotoSolicitado: true, fragancia: 'Natural',
};

export function CotizadorWizard() {
    const { toast } = useToast();
    const [paso, setPaso] = useState(0);
    const [d, setD] = useState<Partial<CotizacionInput>>(INICIAL);
    const [enviando, setEnviando] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [hecho, setHecho] = useState<{ referencia: string } | null>(null);
    // Los ficheros no caben en el estado del formulario (no son serializables): viajan
    // aparte, en una segunda llamada, una vez la cotización ya tiene id.
    const [referencias, setReferencias] = useState<File[]>([]);
    // Se genera una vez por formulario: un doble clic no debe crear dos cotizaciones.
    const [clave] = useState(() => crypto.randomUUID());

    const set = (k: keyof CotizacionInput, v: any) => setD(p => ({ ...p, [k]: v }));
    const conf = d.categoria ? FORMAS[d.categoria as CategoriaId] : null;

    // Cambiar de categoría limpia lo que depende de ella. En la referencia esos datos
    // sobrevivían escondidos y aparecían en el resumen final.
    const elegirCategoria = (id: CategoriaId) => setD(p => ({
        ...p, categoria: id, formas: [], formaOtroDetalle: undefined,
        esAerosol: false, aerosolDetalle: undefined,
        rutaRegulatoria: undefined, tablaNutricional: undefined,
    }));

    const toggleForma = (f: string) => {
        if (!conf) return;
        const actuales = d.formas || [];
        if (conf.multiple) set('formas', actuales.includes(f) ? actuales.filter(x => x !== f) : [...actuales, f]);
        else set('formas', actuales[0] === f ? [] : [f]);
    };

    const toggleEn = (k: 'incluidos' | 'aportaCliente' | 'canalesVenta', v: string) => {
        const a = (d[k] as string[]) || [];
        set(k, a.includes(v) ? a.filter(x => x !== v) : [...a, v]);
    };

    const agregarIngrediente = (k: 'ingredientesIncluir' | 'ingredientesEvitar', valor: string) => {
        const limpio = normalizarIngrediente(valor);
        if (!limpio) return;
        const a = (d[k] as string[]) || [];
        if (a.some(x => x.toLowerCase() === limpio.toLowerCase())) return; // sin duplicados
        set(k, [...a, limpio]);
    };

    // Qué falta para poder avanzar. Se valida por paso para no dejar al usuario
    // descubrir el error al final.
    const faltaEnPaso = useMemo(() => {
        if (paso === 0) return d.categoria ? null : 'Elige una categoría';
        if (paso === 1) {
            if (!d.formas?.length) return 'Elige al menos una forma';
            if (d.formas.includes('Otro') && !d.formaOtroDetalle?.trim()) return 'Describe a qué te refieres con "Otro"';
            return null;
        }
        if (paso === 2) return d.modalidad ? null : 'Elige la modalidad de maquila';
        if (paso === 3) {
            if (!d.rutaFormulacion) return 'Elige cómo será la formulación';
            if (d.fragancia === 'Personalizada' && !d.fraganciaDetalle?.trim()) return 'Describe la fragancia personalizada';
            return null;
        }
        if (paso === 4) {
            if (d.marcaBlanca === undefined) return 'Indica si es marca blanca';
            if (!d.presentacion?.trim()) return 'Indica la presentación, peso o volumen';
            return null;
        }
        if (paso === 5) {
            if (!d.nombre?.trim()) return 'Escribe tu nombre';
            if (!d.email?.trim()) return 'Escribe tu correo';
            if (!d.ciudad?.trim()) return 'Indica la ciudad de entrega';
            return null;
        }
        return null;
    }, [paso, d]);

    const enviar = async () => {
        setEnviando(true); setErrores({});
        try {
            const r = await crearCotizacion(d as CotizacionInput, clave);
            if (r.success) {
                // Los ficheros van en una segunda llamada: la cotización ya está guardada,
                // así que si la subida falla no se pierde el lead — solo las imágenes.
                if (referencias.length) {
                    const fd = new FormData();
                    for (const f of referencias) fd.append('referencias', f);
                    const sub = await subirReferenciasCotizacion(r.id, fd);
                    if (!sub.success) {
                        toast({
                            title: 'Cotización recibida, pero sin las imágenes',
                            description: `${sub.error} Puedes enviárnoslas por correo.`,
                            variant: 'destructive',
                        });
                    }
                }
                setHecho({ referencia: r.referencia });
            }
            else {
                setErrores(r.campos || {});
                toast({ title: 'Revisa el formulario', description: r.error, variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'No se pudo enviar. Inténtalo de nuevo.', variant: 'destructive' });
        } finally { setEnviando(false); }
    };

    if (hecho) {
        return (
            <Card className="max-w-2xl mx-auto">
                <CardHeader className="text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
                    <CardTitle>Cotización recibida</CardTitle>
                    <CardDescription>Guarda esta referencia para hacer seguimiento.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <p className="text-3xl font-mono font-bold">{hecho.referencia}</p>
                    <p className="text-sm text-muted-foreground">
                        Nuestro equipo la revisa y te contacta a <strong>{d.email}</strong>.
                    </p>
                    <Button variant="outline" onClick={() => { setD(INICIAL); setPaso(0); setHecho(null); setReferencias([]); }}>
                        Crear otra cotización
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}</span>
                    <span>{Math.round(((paso + 1) / PASOS.length) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} />
                </div>
            </div>

            <Card>
                <CardContent className="pt-6 space-y-4">
                    {paso === 0 && (
                        <>
                            <Label>¿Qué tipo de producto quieres fabricar?</Label>
                            <div className="grid gap-2">
                                {CATEGORIAS.map(c => (
                                    <button key={c.id} type="button" onClick={() => elegirCategoria(c.id)}
                                        className={`text-left rounded-lg border p-3 hover:bg-muted/50 ${d.categoria === c.id ? 'border-primary bg-primary/5' : ''}`}>
                                        <p className="font-medium">{c.nombre}</p>
                                        <p className="text-xs text-muted-foreground">{c.ejemplos}</p>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {paso === 1 && conf && (
                        <>
                            <Label>{conf.multiple ? 'Formas del producto (puedes elegir varias)' : 'Forma del producto'}</Label>
                            <div className="flex flex-wrap gap-2">
                                {conf.opciones.map(f => (
                                    <button key={f} type="button" onClick={() => toggleForma(f)}
                                        className={`rounded-full border px-3 py-1.5 text-sm ${d.formas?.includes(f) ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'}`}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                            {d.formas?.includes('Otro') && (
                                <div>
                                    <Label htmlFor="otro">Describe la forma *</Label>
                                    <Input id="otro" value={d.formaOtroDetalle || ''} onChange={e => set('formaOtroDetalle', e.target.value)} className="mt-1" />
                                </div>
                            )}
                            {conf.aerosol && (
                                <label className="flex items-center gap-2 pt-2">
                                    <Checkbox checked={!!d.esAerosol} onCheckedChange={v => set('esAerosol', !!v)} />
                                    <span className="text-sm">¿Presentación en aerosol?</span>
                                </label>
                            )}
                            {d.esAerosol && (
                                <Input placeholder="Ej: desodorante, laca, body mist" value={d.aerosolDetalle || ''} onChange={e => set('aerosolDetalle', e.target.value)} />
                            )}
                        </>
                    )}

                    {paso === 2 && (
                        <>
                            <Label>Modalidad de maquila</Label>
                            <div className="grid gap-2">
                                {MODALIDADES.map(m => (
                                    <button key={m.id} type="button" onClick={() => set('modalidad', m.id)}
                                        className={`text-left rounded-lg border p-3 hover:bg-muted/50 ${d.modalidad === m.id ? 'border-primary bg-primary/5' : ''}`}>
                                        <p className="font-medium">{m.nombre}</p>
                                        <p className="text-xs text-muted-foreground">{m.detalle}</p>
                                    </button>
                                ))}
                            </div>
                            {d.modalidad === 'full_service' && (
                                <div className="pt-2">
                                    <Label className="text-sm">¿Qué debe incluir?</Label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {INCLUIDOS_FULL.map(i => (
                                            <button key={i} type="button" onClick={() => toggleEn('incluidos', i)}
                                                className={`rounded-full border px-3 py-1 text-sm ${d.incluidos?.includes(i) ? 'border-primary bg-primary/10' : ''}`}>{i}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {d.modalidad === 'mixta' && (
                                <div className="pt-2">
                                    <Label className="text-sm">¿Qué aportas tú?</Label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {APORTES_CLIENTE.map(i => (
                                            <button key={i} type="button" onClick={() => toggleEn('aportaCliente', i)}
                                                className={`rounded-full border px-3 py-1 text-sm ${d.aportaCliente?.includes(i) ? 'border-primary bg-primary/10' : ''}`}>{i}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <Textarea placeholder="¿Cómo te imaginas el producto final? (opcional)" value={d.descripcionProducto || ''} onChange={e => set('descripcionProducto', e.target.value)} className="resize-none h-20" />
                        </>
                    )}

                    {paso === 3 && (
                        <>
                            <Label>¿Cómo será la formulación?</Label>
                            <div className="grid gap-2">
                                {RUTAS_FORMULACION.map(r => (
                                    <button key={r.id} type="button" onClick={() => set('rutaFormulacion', r.id)}
                                        className={`text-left rounded-lg border p-3 hover:bg-muted/50 ${d.rutaFormulacion === r.id ? 'border-primary bg-primary/5' : ''}`}>
                                        <p className="font-medium">{r.nombre}</p>
                                        <p className="text-xs text-muted-foreground">{r.detalle}</p>
                                    </button>
                                ))}
                            </div>
                            {d.rutaFormulacion === 'aporto' && (
                                <label className="flex items-center gap-2">
                                    <Checkbox checked={!!d.solicitaMejora} onCheckedChange={v => set('solicitaMejora', !!v)} />
                                    <span className="text-sm">Quiero que propongan mejoras de estabilidad, sensorial o costo</span>
                                </label>
                            )}
                            {d.rutaFormulacion === 'desarrollamos' && (
                                <>
                                    <Textarea placeholder="Cuéntanos la idea (opcional)" value={d.ideaFormulacion || ''} onChange={e => set('ideaFormulacion', e.target.value)} className="resize-none h-20" />
                                    <ListaIngredientes titulo="Ingredientes a incluir" items={d.ingredientesIncluir || []}
                                        onAdd={v => agregarIngrediente('ingredientesIncluir', v)}
                                        onDel={v => set('ingredientesIncluir', (d.ingredientesIncluir || []).filter(x => x !== v))} />
                                    <ListaIngredientes titulo="Ingredientes a evitar" items={d.ingredientesEvitar || []}
                                        onAdd={v => agregarIngrediente('ingredientesEvitar', v)}
                                        onDel={v => set('ingredientesEvitar', (d.ingredientesEvitar || []).filter(x => x !== v))} />
                                    <div>
                                        <Label className="text-sm">Fragancia</Label>
                                        <Select value={d.fragancia} onValueChange={v => set('fragancia', v)}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>{FRAGANCIAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                                        </Select>
                                        {d.fragancia === 'Personalizada' && (
                                            <Input className="mt-2" placeholder="Describe la fragancia *" value={d.fraganciaDetalle || ''} onChange={e => set('fraganciaDetalle', e.target.value)} />
                                        )}
                                    </div>
                                </>
                            )}
                            {d.rutaFormulacion === 'muestra' && (
                                <Alert>
                                    <AlertTitle>Envío de muestra física</AlertTitle>
                                    <AlertDescription className="text-sm">
                                        Al enviar la cotización te compartimos la dirección y los datos de envío,
                                        junto con tu número de referencia para rotular la muestra.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </>
                    )}

                    {paso === 4 && (
                        <>
                            <div>
                                <Label>¿Es marca blanca? *</Label>
                                <div className="flex gap-2 mt-1">
                                    {[['Sí', true], ['No', false]].map(([t, v]) => (
                                        <button key={String(v)} type="button" onClick={() => set('marcaBlanca', v)}
                                            className={`rounded-lg border px-4 py-2 text-sm ${d.marcaBlanca === v ? 'border-primary bg-primary/10' : ''}`}>{t as string}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="pres">Presentación, peso o volumen *</Label>
                                <Input id="pres" placeholder="Ej: 120 ml, 60 cápsulas" value={d.presentacion || ''} onChange={e => set('presentacion', e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <Label htmlFor="enlace">Enlace de un producto de referencia</Label>
                                <Input id="enlace" type="url" placeholder="https://…" value={d.enlaceReferencia || ''}
                                    onChange={e => set('enlaceReferencia', e.target.value)} className="mt-1" />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Si has visto algo parecido a lo que buscas, pégalo aquí. Es lo que más
                                    ayuda a cotizar.
                                </p>
                                {errores.enlaceReferencia && <p className="text-xs text-destructive mt-1">{errores.enlaceReferencia}</p>}
                            </div>
                            <div>
                                <Label htmlFor="refs">Imágenes de referencia</Label>
                                <Input id="refs" type="file" multiple accept="image/*,application/pdf" className="mt-1"
                                    onChange={e => setReferencias(Array.from(e.target.files || []).slice(0, 5))} />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Hasta 5 archivos, 8 MB cada uno. Fotos del producto, la etiqueta o el envase.
                                </p>
                                {referencias.length > 0 && (
                                    <p className="text-xs mt-1">{referencias.length} archivo(s): {referencias.map(f => f.name).join(', ')}</p>
                                )}
                            </div>
                            <div>
                                <Label>Cantidad estimada: <strong>{(d.cantidad || 0).toLocaleString('es-CO')}</strong> unidades</Label>
                                <input type="range" min={CANTIDAD.min} max={CANTIDAD.max} step={CANTIDAD.paso}
                                    value={d.cantidad} onChange={e => set('cantidad', Number(e.target.value))} className="w-full mt-2" />
                            </div>
                            {d.categoria && (
                                <div>
                                    <Label className="text-sm">Ruta regulatoria</Label>
                                    <Select value={d.rutaRegulatoria || ''} onValueChange={v => set('rutaRegulatoria', v)}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                                        <SelectContent>
                                            {RUTAS_REGULATORIAS[d.categoria as CategoriaId].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {d.categoria && CATEGORIAS_CON_TABLA_NUTRICIONAL.includes(d.categoria as CategoriaId) && (
                                <label className="flex items-center gap-2">
                                    <Checkbox checked={!!d.tablaNutricional} onCheckedChange={v => set('tablaNutricional', !!v)} />
                                    <span className="text-sm">Necesito tabla nutricional</span>
                                </label>
                            )}
                            <div>
                                <Label className="text-sm">Canales de venta</Label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {CANALES_VENTA.map(c => (
                                        <button key={c} type="button" onClick={() => toggleEn('canalesVenta', c)}
                                            className={`rounded-full border px-3 py-1 text-sm ${d.canalesVenta?.includes(c) ? 'border-primary bg-primary/10' : ''}`}>{c}</button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {paso === 5 && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2 sm:col-span-1">
                                    <Label htmlFor="nom">Nombre *</Label>
                                    <Input id="nom" value={d.nombre || ''} onChange={e => set('nombre', e.target.value)} className="mt-1" />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <Label htmlFor="emp">Empresa o marca</Label>
                                    <Input id="emp" value={d.empresa || ''} onChange={e => set('empresa', e.target.value)} className="mt-1" />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <Label htmlFor="mail">Correo *</Label>
                                    <Input id="mail" type="email" value={d.email || ''} onChange={e => set('email', e.target.value)} className="mt-1" />
                                    {errores.email && <p className="text-xs text-destructive mt-1">{errores.email}</p>}
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <Label htmlFor="tel">WhatsApp</Label>
                                    <Input id="tel" value={d.telefono || ''} onChange={e => set('telefono', e.target.value)} className="mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="ciu">Ciudad de entrega *</Label>
                                    <Input id="ciu" value={d.ciudad || ''} onChange={e => set('ciudad', e.target.value)} className="mt-1" />
                                </div>
                                <div>
                                    <Label>País</Label>
                                    <Select value={d.pais || ''} onValueChange={v => set('pais', v)}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                                        <SelectContent>
                                            {PAISES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Textarea placeholder="¿Algo más que debamos saber? (opcional)" value={d.mensaje || ''} onChange={e => set('mensaje', e.target.value)} className="resize-none h-20" />
                            <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/30">
                                <p className="font-medium">Resumen</p>
                                <p className="text-muted-foreground">
                                    {CATEGORIAS.find(c => c.id === d.categoria)?.nombre} · {d.formas?.join(', ')}
                                    {d.esAerosol ? ' · aerosol' : ''}
                                </p>
                                <p className="text-muted-foreground">
                                    {MODALIDADES.find(m => m.id === d.modalidad)?.nombre} · {RUTAS_FORMULACION.find(r => r.id === d.rutaFormulacion)?.nombre}
                                </p>
                                <p className="text-muted-foreground">{d.presentacion} · {(d.cantidad || 0).toLocaleString('es-CO')} unidades</p>
                            </div>
                        </>
                    )}

                    {faltaEnPaso && <p className="text-xs text-muted-foreground">{faltaEnPaso}</p>}
                </CardContent>
            </Card>

            <div className="flex justify-between">
                <Button variant="outline" disabled={paso === 0 || enviando} onClick={() => setPaso(p => p - 1)}>Anterior</Button>
                {paso < PASOS.length - 1 ? (
                    <Button disabled={!!faltaEnPaso} onClick={() => setPaso(p => p + 1)}>Siguiente</Button>
                ) : (
                    <Button disabled={!!faltaEnPaso || enviando} onClick={enviar}>
                        {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Enviar cotización
                    </Button>
                )}
            </div>
        </div>
    );
}

function ListaIngredientes({ titulo, items, onAdd, onDel }: {
    titulo: string; items: string[]; onAdd: (v: string) => void; onDel: (v: string) => void;
}) {
    const [valor, setValor] = useState('');
    const agregar = () => { onAdd(valor); setValor(''); };
    return (
        <div>
            <Label className="text-sm">{titulo}</Label>
            <div className="flex gap-2 mt-1">
                <Input value={valor} onChange={e => setValor(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
                    placeholder="Escribe y pulsa Enter" className="h-9" />
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={agregar}>Añadir</Button>
            </div>
            {items.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {items.map(i => (
                        <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => onDel(i)}>{i} ×</Badge>
                    ))}
                </div>
            )}
        </div>
    );
}
