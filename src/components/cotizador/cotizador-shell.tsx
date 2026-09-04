"use client";

// Marco del cotizador V5: cabecera fija con el logo del laboratorio, la "ruta de
// cotización" lateral (vertical en escritorio, chips en móvil) y el pie. Es el mismo
// armazón del prototipo aprobado por el equipo.
import type { ReactNode } from 'react';
import { Check, Clock3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PASOS } from './cotizador-estado';

export function Cabecera() {
    return (
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#F0EDE8]">
            <div className="max-w-[1280px] mx-auto px-5 md:px-8 h-[72px] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/adma-laboratorio.jpg" alt="ADMA Laboratorio" className="w-10 h-10 rounded-full object-cover border border-black/5" />
                    <div className="leading-none">
                        <div className="sora font-bold text-[15px] tracking-tight">ADMA LABORATORIO</div>
                        <div className="text-[10px] tracking-[0.18em] text-black/50 font-semibold mt-[2px]">COTIZADOR</div>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-2">
                    {['BPM', 'INVIMA', 'Respuesta 24h', 'Desde 1000 unds', 'Cali'].map(c => (
                        <span key={c} className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#FAFAF8] border border-black/5">{c}</span>
                    ))}
                </div>
                <div className="md:hidden flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-black text-white">Cali</span>
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#FFDE00]">24h</span>
                </div>
            </div>
        </header>
    );
}

export function Ruta({ paso }: { paso: number }) {
    // Con sesión iniciada no hay cabecera propia, así que la ruta se pega más arriba.
    const { user } = useAuth();
    return (
        <aside className={`w-full md:w-[280px] md:sticky shrink-0 ${user ? 'md:top-6' : 'md:top-[88px]'}`}>
            <div className="rounded-[20px] bg-white border border-[#F0EDE8] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-5 md:p-6">
                <div className="sora font-bold text-[14px]">Ruta de cotización</div>
                <div className="text-[12px] text-black/40 mt-1">{PASOS.length} pasos · ~3 minutos</div>

                <div className="md:hidden mt-5 flex gap-2 overflow-x-auto pb-1">
                    {PASOS.map((p, i) => (
                        <div key={p.id} className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border text-[12px] font-semibold ${i === paso ? 'bg-[#111] text-white border-black' : i < paso ? 'bg-[#FFDE00] border-[#FFDE00] text-black' : 'bg-[#FAFAF8] border-black/5 text-black/40'}`}>
                            <span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] ${i < paso ? 'bg-black text-white' : 'bg-white border'}`}>
                                {i < paso ? <Check className="w-3 h-3" /> : i + 1}
                            </span>
                            {p.label}
                        </div>
                    ))}
                </div>

                <div className="hidden md:block relative mt-6">
                    <div className="absolute left-[15px] top-[8px] bottom-[8px] w-[2px] bg-[#F0EDE8]" />
                    <div className="absolute left-[15px] top-[8px] w-[2px] bg-[#FFDE00] transition-all"
                        style={{ height: `${(paso / (PASOS.length - 1)) * 100}%`, maxHeight: 'calc(100% - 16px)' }} />
                    <div className="space-y-5">
                        {PASOS.map((p, i) => {
                            const hecho = i < paso, actual = i === paso;
                            return (
                                <div key={p.id} className="relative flex gap-3 items-start">
                                    <div className={`w-8 h-8 rounded-full grid place-items-center border-2 shrink-0 transition-all ${hecho ? 'bg-[#FFDE00] border-[#FFDE00] text-black' : actual ? 'bg-[#111] border-[#111] text-white shadow-[0_0_0_4px_rgba(255,222,0,0.35)]' : 'bg-white border-[#EDE9E3] text-black/30'}`}>
                                        {hecho ? <Check className="w-4 h-4" /> : <span className="text-[12px] font-bold">{i + 1}</span>}
                                    </div>
                                    <div className={`${actual ? '' : 'opacity-60'} -mt-0.5`}>
                                        <div className="text-[13px] font-bold leading-none sora">{p.label}</div>
                                        <div className="text-[11px] text-black/40 mt-1">{p.desc}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="hidden md:block mt-7 p-3 rounded-[14px] bg-[#FAFAF8] border border-dashed">
                    <div className="flex gap-2 items-center text-[11px] font-bold tracking-wide"><Clock3 className="w-3.5 h-3.5" /> TIEMPO ESTIMADO</div>
                    <div className="text-[12px] text-black/50 mt-1 leading-5">Respuesta en menos de 24h hábiles. Sin compromiso. Confidencial BPM.</div>
                </div>
            </div>
        </aside>
    );
}

export function Pie() {
    return (
        <div className="mt-8 text-center text-[11px] text-black/30">
            ADMA LABORATORIO · Planta certificada BPM · Cumplimiento INVIMA · Cali, Colombia
        </div>
    );
}

// Con un usuario del equipo dentro de la app ya está la barra de navegación principal;
// pintar además la del cotizador ponía dos barras, una encima de la otra. La cabecera
// propia queda solo para el visitante anónimo, que es a quien va dirigido el formulario.
export function Marco({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    return (
        <div className="cotizador-v5 min-h-screen bg-[#FAFAF8] text-[#111] selection:bg-[#FFDE00]">
            {!user && <Cabecera />}
            {children}
        </div>
    );
}
