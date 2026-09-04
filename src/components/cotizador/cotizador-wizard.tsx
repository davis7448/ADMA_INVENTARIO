"use client";

// Formulario de cotización de maquila, versión V5.
//
// Replica el diseño y la estructura del prototipo que aprobó el laboratorio (cabecera,
// ruta lateral, tarjetas, ficha final) con las correcciones de la revisión del
// 2026-09-04, y mantiene lo que la referencia no tenía:
//  · Al cambiar de categoría se limpian los campos que ya no aplican.
//  · La validación se hace por paso y el servidor la repite entera.
//  · La confirmación solo aparece después de que el servidor responde, con el
//    consecutivo que él asignó. Nunca se dice "recibido" antes de que lo esté.
//  · Los ficheros van a Storage y de ahí a ClickUp; el prototipo solo guardaba el nombre.
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FORMAS, PROCLAMA_OTRA, ENVASE_OTRO, type CategoriaId } from '@/lib/cotizador-catalogo';
import type { CotizacionInput } from '@/lib/cotizador-schema';
import { crearCotizacion, subirReferenciasCotizacion } from '@/app/actions/cotizador';
import { Marco, Pie, Ruta } from './cotizador-shell';
import { ARCHIVOS_VACIOS, INICIAL, PASOS, PREFIJO_ARCHIVO, type Archivos, type Datos, type GrupoArchivo } from './cotizador-estado';
import { PasoCategoria, PasoForma } from './pasos-producto';
import { PasoFabricacion } from './paso-fabricacion';
import { PasoFormulacion } from './paso-formulacion';
import { PasoDetalles } from './paso-detalles';
import { PasoCierre } from './paso-cierre';
import { FichaConfirmacion } from './ficha-confirmacion';

export function CotizadorWizard() {
    const { toast } = useToast();
    const [paso, setPaso] = useState(0);
    const [d, setD] = useState<Datos>(INICIAL);
    const [archivos, setArchivosTodos] = useState<Archivos>(ARCHIVOS_VACIOS);
    const [enviando, setEnviando] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [hecho, setHecho] = useState<{ referencia: string } | null>(null);
    // Se genera una vez por formulario: un doble clic no debe crear dos cotizaciones.
    const [clave, setClave] = useState(() => crypto.randomUUID());

    const set = (k: keyof CotizacionInput, v: unknown) => setD(p => ({ ...p, [k]: v }));
    const setArchivos = (grupo: GrupoArchivo, ficheros: File[]) => setArchivosTodos(a => ({ ...a, [grupo]: ficheros }));

    // Cambiar de categoría limpia lo que depende de ella. En la referencia esos datos
    // sobrevivían escondidos y aparecían en el resumen final.
    const elegirCategoria = (id: CategoriaId) => setD(p => ({
        ...p, categoria: id, formas: [], formaOtroDetalle: undefined,
        esAerosol: false, aerosolDetalle: undefined,
        rutaRegulatoria: undefined, tablaNutricional: undefined,
        funcionesCosing: id === 'cosmetico' ? p.funcionesCosing : [],
    }));

    const toggleForma = (f: string) => {
        const conf = d.categoria ? FORMAS[d.categoria as CategoriaId] : null;
        if (!conf) return;
        const actuales = d.formas || [];
        if (conf.multiple) set('formas', actuales.includes(f) ? actuales.filter(x => x !== f) : [...actuales, f]);
        else set('formas', actuales[0] === f ? [] : [f]);
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
        if (paso === 2) {
            if (!d.rolFabricacion) return 'Elige qué papel tendrá ADMA';
            if (!d.modalidad) return 'Elige la modalidad de fabricación';
            return null;
        }
        if (paso === 3) {
            if (!d.rutaFormulacion) return 'Elige cómo será la formulación';
            if (d.rutaFormulacion === 'aporto' && !d.estudiosEstabilidad) return 'Indica si tienes estudios de estabilidad';
            if (d.proclamas?.includes(PROCLAMA_OTRA) && !d.proclamaOtra?.trim()) return 'Describe la proclama que buscas';
            if (d.fragancia === 'Personalizada' && !d.fraganciaDetalle?.trim()) return 'Describe la fragancia personalizada';
            return null;
        }
        if (paso === 4) {
            if (d.marcaBlanca === undefined) return 'Indica si es marca blanca';
            if (!d.presentacion?.trim()) return 'Indica la presentación, peso o volumen';
            if ((d.envaseMaterial === ENVASE_OTRO || d.envaseTipo === ENVASE_OTRO) && !d.envaseDetalle?.trim()) return 'Describe el envase que buscas';
            if (d.tieneRegistro) {
                if (!d.nsoNumero?.trim()) return 'Escribe el número de la NSO';
                if (d.nsoVigente === undefined) return 'Indica si la NSO está vigente';
                if (!d.nsoTitularidad) return 'Indica si la NSO es tuya o de otro laboratorio';
                if (!d.nsoAdicionar) return 'Indica si nos vas a adicionar en la NSO';
                if (d.nsoAdicionar !== 'no' && !d.nsoTramite) return 'Indica quién hace el trámite de la NSO';
            }
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

    // Los ficheros se renombran con el grupo para que en ClickUp se sepa qué es cada uno.
    const ficherosParaEnviar = (): File[] => (Object.keys(archivos) as GrupoArchivo[])
        .flatMap(g => archivos[g].map(f => new File([f], `${PREFIJO_ARCHIVO[g]}__${f.name}`, { type: f.type })));

    const enviar = async () => {
        setEnviando(true); setErrores({});
        try {
            const r = await crearCotizacion(d as CotizacionInput, clave);
            if (r.success) {
                // Los ficheros van en una segunda llamada: la cotización ya está guardada,
                // así que si la subida falla no se pierde el lead — solo los archivos.
                const ficheros = ficherosParaEnviar();
                if (ficheros.length) {
                    const fd = new FormData();
                    for (const f of ficheros) fd.append('referencias', f);
                    const sub = await subirReferenciasCotizacion(r.id, fd);
                    if (!sub.success) {
                        toast({ title: 'Cotización recibida, pero sin los archivos', description: `${sub.error} Puedes enviárnoslos por correo.`, variant: 'destructive' });
                    }
                }
                setHecho({ referencia: r.referencia });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                setErrores(r.campos || {});
                toast({ title: 'Revisa el formulario', description: r.error, variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'No se pudo enviar. Inténtalo de nuevo.', variant: 'destructive' });
        } finally { setEnviando(false); }
    };

    const nueva = () => {
        setD(INICIAL); setArchivosTodos(ARCHIVOS_VACIOS); setPaso(0); setHecho(null); setErrores({});
        setClave(crypto.randomUUID());
    };

    if (hecho) {
        return <Marco><FichaConfirmacion d={d} referencia={hecho.referencia} onNueva={nueva} /></Marco>;
    }

    const props = { d, set, errores, archivos, setArchivos };
    const ultimo = paso === PASOS.length - 1;

    return (
        <Marco>
            <div className="max-w-[1280px] mx-auto px-5 md:px-8 py-6 md:py-10 flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                <Ruta paso={paso} />
                <main className="flex-1 min-w-0 w-full">
                    {paso === 0 && <PasoCategoria d={d} onElegir={elegirCategoria} />}
                    {paso === 1 && <PasoForma d={d} set={set} onToggleForma={toggleForma} />}
                    {paso === 2 && <PasoFabricacion {...props} />}
                    {paso === 3 && <PasoFormulacion {...props} />}
                    {paso === 4 && <PasoDetalles {...props} />}
                    {paso === 5 && <PasoCierre {...props} />}

                    <div className="mt-6 flex items-center justify-between gap-3">
                        <button type="button" onClick={() => setPaso(p => p - 1)} disabled={paso === 0 || enviando}
                            className="px-5 py-2.5 rounded-full border bg-white text-[13px] font-semibold disabled:opacity-30">Anterior</button>
                        <div className="flex items-center gap-3">
                            {faltaEnPaso && <span className="hidden sm:block text-[12px] text-black/40">{faltaEnPaso}</span>}
                            {!ultimo ? (
                                <button type="button" onClick={() => { setPaso(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={!!faltaEnPaso}
                                    className="px-7 py-3 rounded-full bg-black text-white text-[13px] font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90">Siguiente</button>
                            ) : (
                                <button type="button" onClick={enviar} disabled={!!faltaEnPaso || enviando}
                                    className="px-8 py-3 rounded-full bg-[#FFDE00] text-black text-[13px] font-bold border border-black disabled:opacity-30 hover:brightness-[0.95] sora inline-flex items-center gap-2">
                                    {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Enviar cotización →
                                </button>
                            )}
                        </div>
                    </div>
                    {faltaEnPaso && <p className="sm:hidden mt-2 text-right text-[12px] text-black/40">{faltaEnPaso}</p>}
                    <Pie />
                </main>
            </div>
        </Marco>
    );
}
