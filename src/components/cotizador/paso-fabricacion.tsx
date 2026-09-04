"use client";

// Paso 3: modalidad de fabricación. Primero qué papel tendrá ADMA (maquilador,
// envasador, acondicionador o fabricante) y después Full Service o Mixta, como pidió el
// laboratorio en la revisión del 2026-09-04.
import { FlaskConical, Package } from 'lucide-react';
import { APORTES_CLIENTE, INCLUIDOS_FULL, MODALIDADES, ROLES_FABRICACION } from '@/lib/cotizador-catalogo';
import { AREA, Campo, Chip, Opcion, Rotulo, Tarjeta, Titulo, ZonaArchivo } from './cotizador-ui';
import { alternar, type PasoProps } from './cotizador-estado';

export function PasoFabricacion({ d, set, archivos, setArchivos }: PasoProps) {
    return (
        <div className="space-y-5">
            <Titulo titulo="Modalidad de fabricación" detalle="¿Qué papel tendrá ADMA en tu producto?" />
            <div className="grid md:grid-cols-2 gap-4">
                {ROLES_FABRICACION.map(r => (
                    <Opcion key={r.id} activa={d.rolFabricacion === r.id} onClick={() => set('rolFabricacion', r.id)}
                        titulo={r.nombre} detalle={r.detalle} />
                ))}
            </div>

            <Rotulo className="pt-2">¿CÓMO QUIERES PRODUCIR CON ADMA?</Rotulo>
            <div className="grid md:grid-cols-2 gap-4">
                {MODALIDADES.map(m => (
                    <Opcion key={m.id} activa={d.modalidad === m.id} onClick={() => set('modalidad', m.id)}
                        icono={m.id === 'full_service' ? <Package className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
                        iconoAmarillo={m.id === 'full_service'} titulo={m.nombre} detalle={m.detalle} />
                ))}
            </div>

            {d.modalidad === 'full_service' && (
                <Tarjeta className="p-6 md:p-7 space-y-5">
                    <Campo rotulo="INSPIRACIÓN" hijo={
                        <ZonaArchivo rotulo="Subir imagen de inspiración" ayuda="PNG, JPG hasta 8MB" accept="image/*"
                            archivos={archivos.inspiracion} onChange={f => setArchivos('inspiracion', f.slice(0, 1))} />
                    } />
                    <Campo rotulo="INCLUYE" hijo={
                        <div className="flex flex-wrap gap-2">
                            {INCLUIDOS_FULL.map(i => <Chip key={i} activo={!!d.incluidos?.includes(i)} onClick={() => set('incluidos', alternar(d.incluidos, i))}>{i}</Chip>)}
                        </div>
                    } />
                    <Campo rotulo="CÓMO IMAGINAS TU PRODUCTO FINAL" hijo={
                        <textarea value={d.descripcionProducto || ''} onChange={e => set('descripcionProducto', e.target.value)}
                            placeholder="Describe colores, sensación, público, referencia..." className={`min-h-[100px] ${AREA}`} />
                    } />
                </Tarjeta>
            )}

            {d.modalidad === 'mixta' && (
                <Tarjeta className="p-6 md:p-7">
                    <Rotulo className="mb-4">YO APORTO</Rotulo>
                    <div className="grid md:grid-cols-2 gap-3">
                        {APORTES_CLIENTE.map(a => {
                            const activo = !!d.aportaCliente?.includes(a);
                            return (
                                <button key={a} type="button" onClick={() => set('aportaCliente', alternar(d.aportaCliente, a))}
                                    className={`p-4 rounded-[14px] border flex justify-between items-center text-left ${activo ? 'bg-black text-white border-black' : 'bg-white border-black/10'}`}>
                                    <span className="text-[13px] font-semibold">{a}</span>
                                    <span className={`w-10 h-6 rounded-full p-0.5 flex transition ${activo ? 'bg-white/20 justify-end' : 'bg-black/10 justify-start'}`}>
                                        <span className="w-5 h-5 rounded-full bg-white block shadow" />
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </Tarjeta>
            )}
        </div>
    );
}
