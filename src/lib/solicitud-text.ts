// Genera la instrucción de texto que lee el equipo de plataformas a partir de
// las operaciones estructuradas de una solicitud. Función pura: se usa tanto
// en el puente con ClickUp (servidor) como en la vista previa del formulario (cliente).
import type { Modificacion } from '@/app/actions/modificaciones';

export function buildObservacionesText(solicitud: Partial<Modificacion>): string {
    const parts: string[] = [];

    if (solicitud.ES_RETIRO) {
        parts.push('DEJAR EL ID EN CERO (retirar stock de plataforma)');
    }
    if (solicitud.COMBO) {
        const paquetes = solicitud['CANTIDAD SOLICITADA'] || 0;
        const totalUnidades = paquetes * solicitud.COMBO.unidadesPorCombo;
        parts.push(`CREAR VARIABLE/COMBO "${solicitud.COMBO.nombre}": ${paquetes} paquetes × ${solicitud.COMBO.unidadesPorCombo} unds c/u = ${totalUnidades} unidades del producto base`);
    }
    if (solicitud.ACCION_PRIVATIZACION === 'quitar_privatizacion') {
        parts.push('QUITAR PRIVATIZACIÓN (dejar el ID público, eliminar correos privados)');
    } else if (solicitud.ACCION_PRIVATIZACION === 'privatizar' && solicitud.CORREO_CODIGO) {
        parts.push(`PRIVATIZAR a: ${solicitud.CORREO_CODIGO}`);
    }
    if (solicitud.STOCK_POR_VARIANTE?.length) {
        const detalle = solicitud.STOCK_POR_VARIANTE
            .map(v => `${v.cantidad} unds → ${v.variante}${v.sku ? ` (SKU ${v.sku})` : ''}`)
            .join(', ');
        parts.push(`STOCK POR VARIANTE: ${detalle}`);
    }
    for (const d of solicitud.DISTRIBUCION || []) {
        const destino = d.destino === 'privado' ? `PRIVADO${d.correo ? ` a ${d.correo}` : ''}` : 'PÚBLICO';
        parts.push(`${d.cantidad} unds → ${destino}${d.variante ? ` (variante: ${d.variante})` : ''}`);
    }
    if (solicitud.VARIABLE && !solicitud.COMBO) parts.push(`Variante: ${solicitud.VARIABLE}`);
    if (solicitud.OBSERVACIONES) parts.push(solicitud.OBSERVACIONES);

    return parts.join(' | ');
}
