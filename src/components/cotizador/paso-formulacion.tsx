"use client";

// Paso 4: formulación. Tres rutas (aporto, desarrollamos, muestra). Cambios V5 del
// laboratorio: estudios de estabilidad al aportar fórmula, funciones CoSIng en vez de
// idea libre para cosméticos, ingredientes en INCI, proclamas y el aviso del proceso
// de estabilidad.
import { useState } from 'react';
import { FlaskConical, Plus, X } from 'lucide-react';
import {
    AVISO_ESTABILIDAD, CONTACTO_COTIZADOR, ESTUDIOS_ESTABILIDAD, FRAGANCIAS, PROCLAMAS, PROCLAMA_OTRA, RUTAS_FORMULACION,
} from '@/lib/cotizador-catalogo';
import { FUNCIONES_COSING_CLIENTE } from '@/lib/cosing-funciones';
import { normalizarIngrediente } from '@/lib/cotizador-schema';
import { AREA, CAMPO, CAMPO_REDONDO, Campo, CasillaTexto, Chip, Opcion, Rotulo, Tarjeta, Titulo, ZonaArchivo } from './cotizador-ui';
import { alternar, type PasoProps } from './cotizador-estado';

const DOCS = 'application/pdf,.doc,.docx,image/*';

export function PasoFormulacion({ d, set, errores, archivos, setArchivos }: PasoProps) {
    const esCosmetico = d.categoria === 'cosmetico';
    return (
        <div className="space-y-5">
            <Titulo titulo="Formulación" detalle="Elige la ruta para tu fórmula. Profesional, confidencial." />
            <div className="grid md:grid-cols-3 gap-4">
                {RUTAS_FORMULACION.map(r => (
                    <Opcion key={r.id} activa={d.rutaFormulacion === r.id} onClick={() => set('rutaFormulacion', r.id)}
                        icono={<FlaskConical className="w-4 h-4" />} titulo={r.nombre} detalle={r.detalle} />
                ))}
            </div>

            {d.rutaFormulacion === 'aporto' && (
                <Tarjeta className="p-6 md:p-7 space-y-5">
                    <ZonaArchivo rotulo="Subir archivo de fórmula (PDF, DOC)" alto accept={DOCS}
                        archivos={archivos.formula} onChange={f => setArchivos('formula', f.slice(0, 2))} />
                    <Campo rotulo="ESTUDIOS DE ESTABILIDAD" error={errores.estudiosEstabilidad} hijo={
                        <div className="grid md:grid-cols-2 gap-3">
                            {ESTUDIOS_ESTABILIDAD.map(e => (
                                <Opcion key={e.id} activa={d.estudiosEstabilidad === e.id} onClick={() => set('estudiosEstabilidad', e.id)}
                                    titulo={e.nombre} detalle={e.detalle} />
                            ))}
                        </div>
                    } />
                    {d.estudiosEstabilidad === 'tengo' && (
                        <ZonaArchivo rotulo="Subir estudios de estabilidad" multiple accept={DOCS}
                            archivos={archivos.estabilidad} onChange={f => setArchivos('estabilidad', f.slice(0, 3))} />
                    )}
                    {d.estudiosEstabilidad === 'no_tengo' && (
                        <div className="p-4 rounded-[14px] bg-[#FFFEF6] border border-[#FFDE00] text-[12px] leading-5">
                            <b>Sin estudios de estabilidad.</b> Los realizamos nosotros antes de fabricar; se incluyen en la cotización como costo adicional.
                        </div>
                    )}
                    <CasillaTexto marcada={!!d.solicitaMejora} onChange={v => set('solicitaMejora', v)}
                        titulo="Quiero mejorar mi fórmula actual" detalle="Proponemos mejoras de estabilidad, sensorial o costos." />
                </Tarjeta>
            )}

            {d.rutaFormulacion === 'desarrollamos' && (
                <Tarjeta className="p-6 md:p-7 space-y-6">
                    {esCosmetico ? (
                        <Campo rotulo="FUNCIONES DEL PRODUCTO (CoSIng)" error={errores.funcionesCosing}
                            ayuda="Funciones cosméticas avaladas por la Comisión Europea. Elige las que buscas; cualquier otra requiere estudios de soporte."
                            hijo={
                                <div className="flex flex-wrap gap-2">
                                    {FUNCIONES_COSING_CLIENTE.map(f => (
                                        <span key={f.id} title={f.descripcion}>
                                            <Chip activo={!!d.funcionesCosing?.includes(f.id)} onClick={() => set('funcionesCosing', alternar(d.funcionesCosing, f.id))}>{f.nombre}</Chip>
                                        </span>
                                    ))}
                                </div>
                            } />
                    ) : null}
                    <Campo rotulo={esCosmetico ? 'CONTEXTO ADICIONAL (OPCIONAL)' : 'IDEA DE FORMULACIÓN'} hijo={
                        <textarea value={d.ideaFormulacion || ''} onChange={e => set('ideaFormulacion', e.target.value)}
                            placeholder={esCosmetico ? 'Textura, público, sensación, referencia...' : 'Ej: Quiero un suplemento en polvo con proteína vegetal y sabor vainilla...'}
                            className={`min-h-[90px] ${AREA}`} />
                    } />
                    <div className="grid md:grid-cols-2 gap-6">
                        <ListaIngredientes rotulo="INGREDIENTES QUE QUIERES INCLUIR (INCI)" oscuro items={d.ingredientesIncluir || []}
                            placeholder="Ej: NIACINAMIDE + Enter" onChange={v => set('ingredientesIncluir', v)} />
                        <ListaIngredientes rotulo="INGREDIENTES A EVITAR (INCI)" items={d.ingredientesEvitar || []}
                            placeholder="Ej: PHENOXYETHANOL, DIMETHICONE..." onChange={v => set('ingredientesEvitar', v)} />
                    </div>
                    <Campo rotulo="PROCLAMAS DESEADAS" error={errores.proclamaOtra}
                        ayuda="Lo que quieres poder declarar en la etiqueta."
                        hijo={
                            <>
                                <div className="flex flex-wrap gap-2">
                                    {PROCLAMAS.map(p => <Chip key={p} activo={!!d.proclamas?.includes(p)} onClick={() => set('proclamas', alternar(d.proclamas, p))}>{p}</Chip>)}
                                </div>
                                {d.proclamas?.includes(PROCLAMA_OTRA) && (
                                    <>
                                        <input value={d.proclamaOtra || ''} onChange={e => set('proclamaOtra', e.target.value)}
                                            placeholder="Describe la proclama que deseas" className={`mt-3 ${CAMPO}`} />
                                        <div className="mt-2 p-3 rounded-[14px] bg-[#FFFEF6] border border-[#FFDE00] text-[12px] leading-5">
                                            Otra proclama requiere estudios que la respalden. Lo tenemos en cuenta en la cotización.
                                        </div>
                                    </>
                                )}
                            </>
                        } />
                    <div className="grid md:grid-cols-2 gap-4">
                        <Campo rotulo="FRAGANCIA" error={errores.fraganciaDetalle} hijo={
                            <>
                                <select value={d.fragancia || ''} onChange={e => set('fragancia', e.target.value)} className={CAMPO}>
                                    {FRAGANCIAS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                {d.fragancia === 'Personalizada' && (
                                    <input value={d.fraganciaDetalle || ''} onChange={e => set('fraganciaDetalle', e.target.value)}
                                        placeholder="Describe la fragancia que buscas" className={`mt-2 ${CAMPO}`} />
                                )}
                            </>
                        } />
                        <Campo rotulo="INSPIRACIÓN (OPCIONAL)" hijo={
                            <ZonaArchivo rotulo="Subir imagen" accept="image/*" archivos={archivos.inspiracion}
                                onChange={f => setArchivos('inspiracion', f.slice(0, 1))} />
                        } />
                    </div>
                </Tarjeta>
            )}

            {d.rutaFormulacion === 'muestra' && (
                <Tarjeta className="p-6 md:p-7">
                    <div className="p-5 rounded-[16px] bg-[#111] text-white">
                        <div className="text-[12px] font-bold tracking-widest text-white/50">ENVÍO DE MUESTRA</div>
                        <div className="sora font-bold mt-2">ADMA LABORATORIO · Cali, Valle</div>
                        {CONTACTO_COTIZADOR.direccionMuestras ? (
                            <div className="text-[13px] text-white/70 mt-1 leading-6">
                                {CONTACTO_COTIZADOR.direccionMuestras}<br />
                                {CONTACTO_COTIZADOR.atencionMuestras && <>A nombre de: {CONTACTO_COTIZADOR.atencionMuestras}<br /></>}
                            </div>
                        ) : (
                            <div className="text-[13px] text-white/70 mt-1 leading-6">Al confirmar tu cotización te compartimos la dirección y los datos de envío.</div>
                        )}
                        <div className="mt-4 text-[11px] px-3 py-2 rounded-full bg-white/10 inline-flex">Incluye en el paquete: nombre, consecutivo y ficha impresa</div>
                    </div>
                    <div className="mt-4 text-[12px] text-black/50 leading-5">Una vez recibamos la muestra, te confirmamos recepción y análisis en 48h.</div>
                </Tarjeta>
            )}

            {d.rutaFormulacion && (
                <CasillaTexto amarilla marcada={!!d.aceptaEstabilidad} onChange={v => set('aceptaEstabilidad', v)}
                    titulo="Proceso de estabilidad y microbiología" detalle={AVISO_ESTABILIDAD} />
            )}
        </div>
    );
}

// Lista de chips con entrada + Enter, como en el prototipo. Normaliza a INCI (mayúsculas)
// y no repite.
function ListaIngredientes({ rotulo, items, placeholder, oscuro, onChange }: {
    rotulo: string; items: string[]; placeholder: string; oscuro?: boolean; onChange: (v: string[]) => void;
}) {
    const [valor, setValor] = useState('');
    const agregar = () => {
        const limpio = normalizarIngrediente(valor);
        if (!limpio || items.includes(limpio)) { setValor(''); return; }
        onChange([...items, limpio]); setValor('');
    };
    return (
        <div>
            <Rotulo>{rotulo}</Rotulo>
            {items.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {items.map(i => (
                        <span key={i} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] ${oscuro ? 'bg-black text-white' : 'bg-[#FAFAF8] border'}`}>
                            {i}
                            <button type="button" aria-label={`Quitar ${i}`} onClick={() => onChange(items.filter(x => x !== i))}><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                </div>
            )}
            <div className="mt-3 flex gap-2">
                <input value={valor} onChange={e => setValor(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
                    placeholder={placeholder} className={`flex-1 ${CAMPO_REDONDO}`} />
                <button type="button" onClick={agregar} aria-label="Añadir" className="w-10 h-10 rounded-full bg-black text-white grid place-items-center shrink-0">
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
