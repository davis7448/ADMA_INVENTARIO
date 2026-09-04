"use client";

// Pantalla final: "proyecto recibido" con el consecutivo que asignó el servidor y la
// ficha del producto, como en el prototipo V5. Solo se muestra después de que el
// servidor responde: nunca se dice "recibido" antes de que lo esté.
import { FlaskConical, Leaf, Package, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import {
    CATEGORIAS, CONTACTO_COTIZADOR, ESTUDIOS_ESTABILIDAD, MODALIDADES, NSO_ADICIONAR, NSO_TITULARIDAD, NSO_TRAMITE,
    ROLES_FABRICACION, RUTAS_FORMULACION,
} from '@/lib/cotizador-catalogo';
import { nombreFuncionCosing } from '@/lib/cosing-funciones';
import type { Datos } from './cotizador-estado';

const nombre = <T extends { id: string; nombre: string }>(lista: readonly T[], id?: string) => lista.find(x => x.id === id)?.nombre || '—';
const o = (v?: string | null) => v || '—';

export function FichaConfirmacion({ d, referencia, onNueva }: { d: Datos; referencia: string; onNueva: () => void }) {
    const categoria = nombre(CATEGORIAS, d.categoria);
    const forma = `${(d.formas || []).join(', ')}${d.esAerosol ? ` · Aerosol${d.aerosolDetalle ? `: ${d.aerosolDetalle}` : ''}` : ''}`;
    const resumen = `Cotización ${referencia} · ${categoria} · ${forma} · ${(d.cantidad || 0).toLocaleString('es-CO')} unds · ${d.presentacion}`;
    const whatsapp = CONTACTO_COTIZADOR.whatsapp
        ? `https://wa.me/${CONTACTO_COTIZADOR.whatsapp}?text=${encodeURIComponent(`Hola ADMA Laboratorio, soy ${d.nombre}${d.empresa ? ` de ${d.empresa}` : ''}. ${resumen}. Quisiera continuar con mi cotización.`)}`
        : null;
    const correo = CONTACTO_COTIZADOR.correoComercial
        ? `mailto:${CONTACTO_COTIZADOR.correoComercial}?subject=${encodeURIComponent(`Cotización ${referencia}`)}&body=${encodeURIComponent(resumen)}`
        : null;

    return (
        <div className="relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute w-full h-[420px] bg-white" />
                <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#FFDE00 2px, transparent 2px)', backgroundSize: '28px 28px' }} />
                <div className="absolute top-16 left-[10%] w-2 h-6 rotate-12 bg-[#FFDE00] rounded-full opacity-60" />
                <div className="absolute top-28 right-[12%] w-2 h-5 -rotate-12 bg-[#FFDE00] rounded-full opacity-40" />
                <div className="absolute top-40 left-[22%] w-1.5 h-4 rotate-45 bg-[#111] rounded-full opacity-10" />
            </div>
            <div className="max-w-[980px] mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-12 relative">
                <div className="text-center max-w-[720px] mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFDE00] text-[11px] font-bold tracking-wide mb-5"><Sparkles className="w-3.5 h-3.5" /> PROYECTO RECIBIDO</div>
                    <h1 className="sora font-bold text-[32px] md:text-[42px] leading-[0.95] tracking-tight">¡Felicidades por tomar acción!</h1>
                    <p className="mt-5 text-[16px] md:text-[18px] leading-7 text-black/60 max-w-[640px] mx-auto">
                        Acabas de iniciar el camino de tu propia marca. En ADMA LABORATORIO nos sentimos honrados de acompañarte en este sueño. Tu proyecto ya está en manos de nuestro equipo técnico.
                    </p>
                    <div className="mt-8 flex flex-col items-center">
                        <div className="px-6 py-3 rounded-full bg-[#111] text-white sora font-bold text-[18px] tracking-wide">{referencia}</div>
                        <div className="mt-3 text-[13px] font-medium text-black/50">Consecutivo único de tu proyecto</div>
                        <div className="mt-6 text-[14px] font-semibold bg-white border border-black/5 rounded-full px-4 py-2">Te enviamos tu cotización personalizada en menos de 24h hábiles</div>
                    </div>
                    <div className="mt-10 grid grid-cols-3 gap-3 text-left">
                        {[{ k: 'Hoy', t: 'Análisis', d: 'Revisamos tu ficha técnica inicial' }, { k: '24h', t: 'Cotización', d: 'Propuesta comercial + tiempos' }, { k: 'Juntos', t: 'Inicio', d: 'Muestra piloto y producción' }].map(c => (
                            <div key={c.k} className="rounded-[20px] bg-white border border-[#F0EDE8] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-4 md:p-5">
                                <div className="text-[11px] font-bold tracking-widest text-black/40">{c.k.toUpperCase()}</div>
                                <div className="sora font-bold mt-1">{c.t}</div>
                                <div className="text-[12px] leading-5 text-black/50 mt-1">{c.d}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-14 rounded-[20px] bg-white border border-[#F0EDE8] shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="px-6 md:px-8 py-6 border-b border-[#F0EDE8] flex items-center justify-between bg-[#FFFEF6]">
                        <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/adma-laboratorio.jpg" className="w-9 h-9 rounded-full" alt="ADMA Laboratorio" />
                            <div>
                                <div className="sora font-bold leading-none">FICHA DE PRODUCTO A COTIZAR</div>
                                <div className="text-[11px] text-black/40 mt-1 font-medium">ADMA LABORATORIO · BPM · INVIMA · CALI</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[11px] font-bold tracking-widest text-black/40">CONSECUTIVO</div>
                            <div className="sora font-bold">{referencia}</div>
                            <div className="text-[11px] text-black/40 mt-1">{new Date().toLocaleDateString('es-CO')}</div>
                        </div>
                    </div>
                    <div className="p-6 md:p-8 grid md:grid-cols-12 gap-8">
                        <div className="md:col-span-4 space-y-6">
                            <Seccion icono={<ShieldCheck className="w-4 h-4" />} titulo="CLIENTE">
                                <Linea k="Nombre" v={<b>{o(d.nombre)}</b>} /><Linea k="Empresa" v={o(d.empresa)} /><Linea k="Marca" v={o(d.marca)} />
                                <Linea k="Email" v={o(d.email)} /><Linea k="Tel" v={o(d.telefono)} /><Linea k="Entrega" v={`${o(d.ciudad)}${d.pais ? ` · ${d.pais}` : ''}`} />
                            </Seccion>
                            <Seccion icono={<Leaf className="w-4 h-4" />} titulo="COMERCIAL">
                                <Linea k="Vende en" v={(d.canalesVenta || []).join(', ') || '—'} /><Linea k="Nos conoció" v={o(d.origenLead)} />
                                <Linea k="Cantidad" v={`${(d.cantidad || 0).toLocaleString('es-CO')} unds`} /><Linea k="Presentación" v={o(d.presentacion)} />
                            </Seccion>
                        </div>
                        <div className="md:col-span-8 space-y-6">
                            <section className="grid sm:grid-cols-2 gap-6">
                                <Seccion icono={<FlaskConical className="w-4 h-4" />} titulo="CATEGORÍA Y FORMA">
                                    <div className="text-[14px]"><span className="inline-flex px-2.5 py-1 rounded-full bg-[#111] text-white text-[11px] font-bold mr-2">{categoria}</span>{forma || '—'}</div>
                                    <div className="mt-3 text-[12px] text-black/50 leading-5">
                                        Marca blanca: <b className="text-black">{d.marcaBlanca ? 'Sí' : 'No'}</b> · Registro: {o(d.rutaRegulatoria)}
                                        {d.tablaNutricional !== undefined && <> · Tabla nutricional: {d.tablaNutricional ? 'Sí' : 'No'}</>}
                                        {d.variantesColor && <> · Colores: {d.variantesColor}</>}
                                        {(d.envaseMaterial || d.envaseTipo) && <> · Envase: {[d.envaseMaterial, d.envaseTipo, d.envaseDetalle].filter(Boolean).join(' / ')}</>}
                                    </div>
                                </Seccion>
                                <Seccion icono={<Package className="w-4 h-4" />} titulo="FABRICACIÓN">
                                    <div className="font-semibold text-[14px]">{nombre(ROLES_FABRICACION, d.rolFabricacion)} · {nombre(MODALIDADES, d.modalidad)}</div>
                                    <div className="text-[12px] text-black/60 mt-1">
                                        {d.modalidad === 'full_service' ? `Incluye: ${(d.incluidos || []).join(', ') || '—'}` : `Aporta el cliente: ${(d.aportaCliente || []).join(', ') || '—'}`}
                                    </div>
                                    {d.descripcionProducto && <div className="text-[12px] text-black/60 mt-1">Idea final: {d.descripcionProducto}</div>}
                                    {d.tieneRegistro && (
                                        <div className="text-[12px] text-black/60 mt-1">
                                            NSO {o(d.nsoNumero)} · {d.nsoVigente ? 'vigente' : 'no vigente'} · {nombre(NSO_TITULARIDAD, d.nsoTitularidad)}
                                            {d.nsoAdicionar && d.nsoAdicionar !== 'no' && <> · Adicionar {nombre(NSO_ADICIONAR, d.nsoAdicionar).toLowerCase()} · trámite: {nombre(NSO_TRAMITE, d.nsoTramite)}</>}
                                        </div>
                                    )}
                                </Seccion>
                            </section>
                            <Seccion icono={<FlaskConical className="w-4 h-4" />} titulo="FORMULACIÓN">
                                <div className="grid sm:grid-cols-3 gap-4 text-[13px]">
                                    <Cajita titulo={`Ruta: ${nombre(RUTAS_FORMULACION, d.rutaFormulacion)}`}>
                                        {d.rutaFormulacion === 'aporto' && <>Estabilidad: {nombre(ESTUDIOS_ESTABILIDAD, d.estudiosEstabilidad)} · Mejorar: {d.solicitaMejora ? 'Sí' : 'No'}</>}
                                        {d.rutaFormulacion === 'muestra' && 'Envío físico de muestra al laboratorio'}
                                        {d.rutaFormulacion === 'desarrollamos' && ((d.funcionesCosing || []).map(nombreFuncionCosing).join(', ') || d.ideaFormulacion || 'Idea por desarrollar')}
                                    </Cajita>
                                    <Cajita titulo="Incluir (INCI)"><Chips items={d.ingredientesIncluir} /><div className="font-bold text-[12px] mt-3 mb-1">Fragancia</div><div className="text-black/60 text-[12px]">{o(d.fragancia)}{d.fraganciaDetalle ? ` — ${d.fraganciaDetalle}` : ''}</div></Cajita>
                                    <Cajita titulo="Evitar (INCI)"><Chips items={d.ingredientesEvitar} /><div className="font-bold text-[12px] mt-3 mb-1">Proclamas</div><div className="text-black/60 text-[12px]">{(d.proclamas || []).join(', ') || '—'}{d.proclamaOtra ? ` — ${d.proclamaOtra}` : ''}</div></Cajita>
                                </div>
                            </Seccion>
                            <Seccion icono={<Truck className="w-4 h-4" />} titulo="MENSAJE">
                                <div className="p-4 rounded-[14px] bg-white border border-dashed text-[13px] leading-6 text-black/70">{d.mensaje || 'Sin mensaje adicional'}</div>
                            </Seccion>
                        </div>
                    </div>
                    <div className="px-6 md:px-8 py-5 bg-[#FAFAF8] border-t border-[#F0EDE8] flex flex-col md:flex-row gap-3 md:items-center justify-between">
                        <div className="text-[12px] text-black/50 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Confidencialidad BPM INVIMA · Piloto: {d.pilotoSolicitado ? 'Sí' : 'No'}</div>
                        {(whatsapp || correo) && (
                            <div className="flex gap-2">
                                {whatsapp && <a href={whatsapp} target="_blank" rel="noopener" className="px-5 py-2.5 rounded-full bg-[#111] text-white text-[13px] font-semibold hover:opacity-90">Enviar por WhatsApp</a>}
                                {correo && <a href={correo} className="px-5 py-2.5 rounded-full bg-white border border-black/10 text-[13px] font-semibold">Enviar por Email</a>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-8 flex justify-center">
                    <button type="button" onClick={onNueva} className="text-[13px] font-semibold text-black/50 underline">Crear nueva cotización</button>
                </div>
            </div>
        </div>
    );
}

function Seccion({ icono, titulo, children }: { icono: React.ReactNode; titulo: string; children: React.ReactNode }) {
    return (
        <section>
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-black/40 mb-3">{icono} {titulo}</div>
            <div className="space-y-1 text-[14px]">{children}</div>
        </section>
    );
}
function Linea({ k, v }: { k: string; v: React.ReactNode }) {
    return <div><span className="text-black/40">{k}:</span> {v}</div>;
}
function Cajita({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return <div className="p-4 rounded-[14px] bg-[#FAFAF8] border border-black/5"><div className="font-bold text-[12px] mb-1">{titulo}</div><div className="text-black/60">{children}</div></div>;
}
function Chips({ items }: { items?: string[] }) {
    if (!items?.length) return <span className="text-[12px]">—</span>;
    return <div className="flex flex-wrap gap-1.5">{items.map(i => <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-white border">{i}</span>)}</div>;
}
