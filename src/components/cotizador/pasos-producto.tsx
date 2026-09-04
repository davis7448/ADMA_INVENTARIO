"use client";

// Pasos 1 y 2: categoría y forma del producto.
import { CATEGORIAS, FORMAS, type CategoriaId } from '@/lib/cotizador-catalogo';
import { Bloque, CAMPO, CAMPO_REDONDO, Chip, Opcion, Rotulo, Tarjeta, Titulo } from './cotizador-ui';
import type { PasoProps } from './cotizador-estado';

const ICONO: Record<CategoriaId, string> = { cosmetico: '🧴', alimento: '🥫', suplemento: '💊', veterinario: '🐾', industrial: '🧼' };

export function PasoCategoria({ d, onElegir }: Pick<PasoProps, 'd'> & { onElegir: (id: CategoriaId) => void }) {
    return (
        <div className="space-y-5">
            <Titulo titulo="¿Qué tipo de producto quieres desarrollar?"
                detalle="Selecciona una categoría principal. Solo 5 opciones para mantener la producción enfocada." />
            <div className="grid md:grid-cols-2 gap-4">
                {CATEGORIAS.map(c => (
                    <Opcion key={c.id} activa={d.categoria === c.id} onClick={() => onElegir(c.id)}
                        icono={ICONO[c.id]} titulo={c.nombre} detalle={c.ejemplos.charAt(0).toUpperCase() + c.ejemplos.slice(1)} />
                ))}
            </div>
        </div>
    );
}

export function PasoForma({ d, set, onToggleForma }: Pick<PasoProps, 'd' | 'set'> & { onToggleForma: (f: string) => void }) {
    const cat = CATEGORIAS.find(c => c.id === d.categoria);
    const conf = d.categoria ? FORMAS[d.categoria as CategoriaId] : null;
    if (!cat || !conf) return null;
    return (
        <div className="space-y-5">
            <Titulo titulo="Forma y presentación"
                detalle={<>Categoría: <b className="text-black">{cat.nombre}</b>. Define la forma exacta de tu producto.</>} />
            <Tarjeta className="p-6 md:p-7">
                <div className="flex items-center gap-2 mb-4">
                    <Rotulo>{conf.multiple ? 'SELECCIÓN MÚLTIPLE' : 'FORMA'}</Rotulo>
                    {d.categoria === 'suplemento' && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#FFDE00]">PLANTA GOMAS</span>}
                </div>
                {conf.multiple ? (
                    <div className="flex flex-wrap gap-2">
                        {conf.opciones.map(f => <Chip key={f} activo={!!d.formas?.includes(f)} onClick={() => onToggleForma(f)}>{f}</Chip>)}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {conf.opciones.map(f => (
                            <Bloque key={f} activo={d.formas?.[0] === f} onClick={() => onToggleForma(f)}>
                                <span>{f}</span>
                                {f === 'Gomas' && <span className="text-[10px] px-2 py-1 rounded-full bg-[#FFDE00] text-black font-bold">PROPIO</span>}
                            </Bloque>
                        ))}
                    </div>
                )}
                {d.formas?.includes('Otro') && (
                    <input value={d.formaOtroDetalle || ''} onChange={e => set('formaOtroDetalle', e.target.value)}
                        placeholder="Describe tu forma..." className={`mt-4 ${CAMPO}`} />
                )}
                {d.categoria === 'alimento' && <div className="mt-4 text-[11px] text-black/40">Nota: no se incluye bebida ni aerosol en alimentos.</div>}
                {conf.aerosol && (
                    <div className="mt-6 p-4 rounded-[14px] bg-[#FAFAF8] border flex items-start gap-3">
                        <input type="checkbox" checked={!!d.esAerosol} onChange={e => set('esAerosol', e.target.checked)} className="mt-1 w-4 h-4 accent-black" />
                        <div className="flex-1">
                            <div className="text-[13px] font-semibold">¿Presentación en aerosol?</div>
                            <div className="text-[12px] text-black/50">Activa si tu producto final será presurizado.</div>
                            {d.esAerosol && (
                                <input value={d.aerosolDetalle || ''} onChange={e => set('aerosolDetalle', e.target.value)}
                                    placeholder="Ej: Desodorante aerosol, Laca, Body mist..." className={`mt-3 ${CAMPO_REDONDO}`} />
                            )}
                        </div>
                    </div>
                )}
            </Tarjeta>
        </div>
    );
}
