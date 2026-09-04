"use client";

// Paso 5: detalles técnicos. V5 añade marca, variantes de color, envase y el bloque de
// NSO (número, vigencia, titularidad, adición de ADMA y quién tramita).
import {
    CANALES_VENTA, CANTIDAD, CATEGORIAS_CON_TABLA_NUTRICIONAL, ENVASE_MATERIALES, ENVASE_OTRO, ENVASE_TIPOS,
    NSO_ADICIONAR, NSO_TITULARIDAD, NSO_TRAMITE, ORIGENES_LEAD, RUTAS_REGULATORIAS, type CategoriaId,
} from '@/lib/cotizador-catalogo';
import { CAMPO, CAMPO_REDONDO, Campo, Chip, Pildora, Rotulo, Tarjeta, Titulo, ZonaArchivo } from './cotizador-ui';
import { alternar, type PasoProps } from './cotizador-estado';

export function PasoDetalles({ d, set, errores, archivos, setArchivos }: PasoProps) {
    const cat = d.categoria as CategoriaId | undefined;
    const envaseOtro = d.envaseMaterial === ENVASE_OTRO || d.envaseTipo === ENVASE_OTRO;
    return (
        <div className="space-y-5">
            <Titulo titulo="Detalles técnicos" detalle="Información para cotizar con precisión." />
            <Tarjeta className="p-6 md:p-7 space-y-7">
                <div className="grid md:grid-cols-3 gap-6">
                    <Campo rotulo="MARCA BLANCA" hijo={
                        <div className="flex gap-2">
                            {[['Sí', true], ['No', false]].map(([t, v]) => (
                                <Pildora key={String(v)} activo={d.marcaBlanca === v} onClick={() => set('marcaBlanca', v)}>{t as string}</Pildora>
                            ))}
                        </div>
                    } />
                    <Campo rotulo="TU MARCA" hijo={
                        <input value={d.marca || ''} onChange={e => set('marca', e.target.value)} placeholder="Nombre de tu marca" className={CAMPO_REDONDO} />
                    } />
                    {cat && (
                        <Campo rotulo="REGISTRO SANITARIO" hijo={
                            <select value={d.rutaRegulatoria || ''} onChange={e => set('rutaRegulatoria', e.target.value || undefined)} className={CAMPO_REDONDO}>
                                <option value="">Selecciona</option>
                                {RUTAS_REGULATORIAS[cat].map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        } />
                    )}
                    {cat && CATEGORIAS_CON_TABLA_NUTRICIONAL.includes(cat) && (
                        <Campo rotulo="TABLA NUTRICIONAL" hijo={
                            <div className="flex gap-2">
                                {[['Sí', true], ['No', false]].map(([t, v]) => (
                                    <Pildora key={String(v)} activo={d.tablaNutricional === v} onClick={() => set('tablaNutricional', v)}>{t as string}</Pildora>
                                ))}
                            </div>
                        } />
                    )}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <Campo rotulo="PRESENTACIÓN (PESO / VOLUMEN)" error={errores.presentacion} hijo={
                        <input value={d.presentacion || ''} onChange={e => set('presentacion', e.target.value)} placeholder="Ej: 120 ml, 500 g, 30 unidades..." className={CAMPO} />
                    } />
                    <div>
                        <div className="flex justify-between">
                            <Rotulo>CANTIDAD A COTIZAR</Rotulo>
                            <span className="text-[12px] font-bold bg-[#FFDE00] px-2.5 py-1 rounded-full">{(d.cantidad || 0).toLocaleString('es-CO')} unds</span>
                        </div>
                        <input type="range" min={CANTIDAD.min} max={CANTIDAD.max} step={CANTIDAD.paso} value={d.cantidad || CANTIDAD.inicial}
                            onChange={e => set('cantidad', Number(e.target.value))} className="w-full mt-5 accent-black" />
                        <div className="flex justify-between text-[11px] text-black/40 mt-1">
                            <span>{CANTIDAD.min.toLocaleString('es-CO')} mínimo</span><span>{CANTIDAD.max.toLocaleString('es-CO')}+</span>
                        </div>
                    </div>
                </div>

                <Campo rotulo="VARIANTES DE COLOR" ayuda="Si quieres varias versiones (tonos, colores del producto o del envase), cuéntanos cuáles." hijo={
                    <input value={d.variantesColor || ''} onChange={e => set('variantesColor', e.target.value)} placeholder="Ej: 3 tonos: claro, medio y oscuro" className={CAMPO} />
                } />

                <div className="space-y-4">
                    <Campo rotulo="ENVASE · MATERIAL" hijo={
                        <div className="flex flex-wrap gap-2">
                            {ENVASE_MATERIALES.map(m => <Chip key={m} activo={d.envaseMaterial === m} onClick={() => set('envaseMaterial', d.envaseMaterial === m ? undefined : m)}>{m}</Chip>)}
                        </div>
                    } />
                    <Campo rotulo="ENVASE · TIPO" error={errores.envaseDetalle} hijo={
                        <>
                            <div className="flex flex-wrap gap-2">
                                {ENVASE_TIPOS.map(t => <Chip key={t} activo={d.envaseTipo === t} onClick={() => set('envaseTipo', d.envaseTipo === t ? undefined : t)}>{t}</Chip>)}
                            </div>
                            {envaseOtro && (
                                <input value={d.envaseDetalle || ''} onChange={e => set('envaseDetalle', e.target.value)} placeholder="Describe el envase que buscas" className={`mt-3 ${CAMPO}`} />
                            )}
                        </>
                    } />
                </div>

                <BloqueNso d={d} set={set} errores={errores} />

                <div className="grid md:grid-cols-2 gap-6">
                    <Campo rotulo="ENLACE DE UN PRODUCTO DE REFERENCIA" error={errores.enlaceReferencia}
                        ayuda="Si has visto algo parecido a lo que buscas, pégalo aquí. Es lo que más ayuda a cotizar."
                        hijo={<input type="url" value={d.enlaceReferencia || ''} onChange={e => set('enlaceReferencia', e.target.value)} placeholder="https://…" className={CAMPO} />} />
                    <Campo rotulo="IMÁGENES DE REFERENCIA" hijo={
                        <ZonaArchivo rotulo="Subir fotos del producto, etiqueta o envase" ayuda="Hasta 4 archivos, 8 MB cada uno" multiple accept="image/*,application/pdf"
                            archivos={archivos.referencias} onChange={f => setArchivos('referencias', f.slice(0, 4))} />
                    } />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    <Campo rotulo="¿CÓMO VENDES? (MÚLTIPLE)" hijo={
                        <div className="flex flex-wrap gap-2">
                            {CANALES_VENTA.map(c => <Chip key={c} activo={!!d.canalesVenta?.includes(c)} onClick={() => set('canalesVenta', alternar(d.canalesVenta, c))}>{c}</Chip>)}
                        </div>
                    } />
                    <Campo rotulo="¿CÓMO NOS CONOCISTE?" hijo={
                        <div className="flex flex-wrap gap-2">
                            {ORIGENES_LEAD.map(o => <Chip key={o} activo={d.origenLead === o} onClick={() => set('origenLead', o)}>{o}</Chip>)}
                        </div>
                    } />
                </div>
            </Tarjeta>
        </div>
    );
}

// NSO = Notificación Sanitaria Obligatoria. Solo se despliega si el cliente ya tiene una.
function BloqueNso({ d, set, errores }: Pick<PasoProps, 'd' | 'set' | 'errores'>) {
    const limpiar = () => {
        set('nsoNumero', undefined); set('nsoVigente', undefined); set('nsoTitularidad', undefined);
        set('nsoAdicionar', undefined); set('nsoTramite', undefined);
    };
    return (
        <div className="p-5 rounded-[16px] bg-[#FAFAF8] border space-y-5">
            <Campo rotulo="¿YA TIENES NSO O REGISTRO SANITARIO DEL PRODUCTO?" ayuda="NSO: Notificación Sanitaria Obligatoria ante el INVIMA." hijo={
                <div className="flex gap-2 max-w-sm">
                    <Pildora activo={d.tieneRegistro === true} onClick={() => set('tieneRegistro', true)}>Sí</Pildora>
                    <Pildora activo={d.tieneRegistro === false} onClick={() => { set('tieneRegistro', false); limpiar(); }}>No</Pildora>
                </div>
            } />
            {d.tieneRegistro && (
                <>
                    <div className="grid md:grid-cols-2 gap-5">
                        <Campo rotulo="NÚMERO DE NSO" error={errores.nsoNumero} hijo={
                            <input value={d.nsoNumero || ''} onChange={e => set('nsoNumero', e.target.value)} placeholder="Ej: NSOC12345-20CO" className={CAMPO} />
                        } />
                        <Campo rotulo="¿ESTÁ VIGENTE?" error={errores.nsoVigente} hijo={
                            <div className="flex gap-2">
                                <Pildora activo={d.nsoVigente === true} onClick={() => set('nsoVigente', true)}>Sí</Pildora>
                                <Pildora activo={d.nsoVigente === false} onClick={() => set('nsoVigente', false)}>No</Pildora>
                            </div>
                        } />
                    </div>
                    <Campo rotulo="¿LA NSO ES TUYA?" error={errores.nsoTitularidad}
                        ayuda="Si es de otro laboratorio, normalmente no comparte la fórmula; lo tenemos en cuenta."
                        hijo={
                            <div className="flex flex-wrap gap-2">
                                {NSO_TITULARIDAD.map(t => <Chip key={t.id} activo={d.nsoTitularidad === t.id} onClick={() => set('nsoTitularidad', t.id)}>{t.nombre}</Chip>)}
                            </div>
                        } />
                    <Campo rotulo="¿NOS VAS A ADICIONAR EN LA NSO?" error={errores.nsoAdicionar} hijo={
                        <div className="flex flex-wrap gap-2">
                            {NSO_ADICIONAR.map(a => <Chip key={a.id} activo={d.nsoAdicionar === a.id} onClick={() => { set('nsoAdicionar', a.id); if (a.id === 'no') set('nsoTramite', undefined); }}>{a.nombre}</Chip>)}
                        </div>
                    } />
                    {d.nsoAdicionar && d.nsoAdicionar !== 'no' && (
                        <Campo rotulo="¿QUIÉN HACE EL TRÁMITE?" error={errores.nsoTramite} hijo={
                            <div className="flex gap-2 max-w-sm">
                                {NSO_TRAMITE.map(t => <Pildora key={t.id} activo={d.nsoTramite === t.id} onClick={() => set('nsoTramite', t.id)}>{t.nombre}</Pildora>)}
                            </div>
                        } />
                    )}
                </>
            )}
        </div>
    );
}
