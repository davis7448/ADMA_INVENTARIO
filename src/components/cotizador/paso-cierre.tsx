"use client";

// Paso 6: cierre y entrega. Datos de contacto, país (para el dropdown de ClickUp),
// mensaje y las dos casillas de confidencialidad y piloto.
import { PAISES } from '@/lib/cotizador-catalogo';
import { AREA, CAMPO, Campo, CasillaTexto, Tarjeta, Titulo } from './cotizador-ui';
import type { PasoProps } from './cotizador-estado';

export function PasoCierre({ d, set, errores }: Pick<PasoProps, 'd' | 'set' | 'errores'>) {
    return (
        <div className="space-y-5">
            <Titulo titulo="Cierre y entrega" detalle="Últimos datos para enviar tu cotización en 24h." />
            <Tarjeta className="p-6 md:p-7 space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                    <Campo rotulo="NOMBRE COMPLETO *" error={errores.nombre} hijo={
                        <input value={d.nombre || ''} onChange={e => set('nombre', e.target.value)} placeholder="Tu nombre" className={CAMPO} />
                    } />
                    <Campo rotulo="EMPRESA" hijo={
                        <input value={d.empresa || ''} onChange={e => set('empresa', e.target.value)} placeholder="Razón social o nombre comercial" className={CAMPO} />
                    } />
                    <Campo rotulo="EMAIL *" error={errores.email} hijo={
                        <input type="email" value={d.email || ''} onChange={e => set('email', e.target.value)} placeholder="tucorreo@email.com" className={CAMPO} />
                    } />
                    <Campo rotulo="TEL / WHATSAPP" hijo={
                        <input value={d.telefono || ''} onChange={e => set('telefono', e.target.value)} placeholder="+57 300..." className={CAMPO} />
                    } />
                    <Campo rotulo="CIUDAD DE ENTREGA *" error={errores.ciudad} hijo={
                        <input value={d.ciudad || ''} onChange={e => set('ciudad', e.target.value)} placeholder="Ej: Bogotá, Medellín, Cali..." className={CAMPO} />
                    } />
                    <Campo rotulo="PAÍS" error={errores.pais} hijo={
                        <select value={d.pais || ''} onChange={e => set('pais', e.target.value || undefined)} className={CAMPO}>
                            <option value="">Selecciona</option>
                            {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    } />
                </div>
                <Campo rotulo="MENSAJE ADICIONAL" hijo={
                    <textarea value={d.mensaje || ''} onChange={e => set('mensaje', e.target.value)} placeholder="Cuéntanos algo más que debamos saber..." className={`min-h-[90px] ${AREA}`} />
                } />
                <div className="space-y-3">
                    <CasillaTexto marcada={!!d.confidencialidad} onChange={v => set('confidencialidad', v)}
                        titulo="Confidencialidad BPM INVIMA."
                        detalle="Entiendo que mi información y fórmula serán tratadas bajo acuerdo de confidencialidad y buenas prácticas de manufactura." />
                    <CasillaTexto amarilla marcada={!!d.pilotoSolicitado} onChange={v => set('pilotoSolicitado', v)}
                        titulo="Solicito muestra piloto." detalle="Quiero cotizar lote piloto antes de producción masiva." />
                </div>
            </Tarjeta>
        </div>
    );
}
