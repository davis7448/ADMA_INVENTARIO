// Qué estados de Dropi significan que el pedido YA SALIÓ de la bodega.
//
// Por qué existe: el tablero de pedidos por país y bodega cuenta despachos, y Dropi no
// entrega una fecha de despacho — solo `created_at` y el estado ACTUAL de la orden. La
// única forma de saber si un pedido salió es mirar su estado.
//
// Se mantiene aquí, en un solo sitio, porque lo usan el agregador
// (scripts/agregar-pedidos-diarios.ts) y la lectura (src/app/actions/pedidos-por-pais.ts).
// Si divergieran, el tablero mostraría un número y el Excel otro.
//
// ⚠️ Dropi añade estados nuevos cada cierto tiempo. Un estado desconocido se cuenta como
// NO despachado, así que el efecto de quedarse corto es subestimar, nunca inflar. Para
// revisar si apareció alguno nuevo:
//   npx tsx scripts/agregar-pedidos-diarios.ts --estados

// Ya salió: entregado al transportador o más allá (incluye los que volvieron, porque
// para salir tuvieron que despacharse primero).
export const ESTADOS_DESPACHADOS = new Set([
    'DESPACHADA',
    'EN TRANSITO',
    'EN TRANSPORTE',
    'EN TERMINAL ORIGEN',
    'EN TERMINAL DESTINO',
    'EN BODEGA TRANSPORTADORA',
    'BODEGA DESTINO',
    'EN BODEGA DESTINO',
    'EN REPARTO',
    'EN RUTA',
    'EN CAMINO',
    'EN DISTRIBUCION',
    'EN REEXPEDICION',
    'EN TRASLADO NACIONAL',
    'EN ESPERA DE RUTA DOMESTICA',
    'RECOGIDO POR DROPI',
    'INTENTO DE ENTREGA',
    'RECLAME EN OFICINA',
    'NOVEDAD',
    'REENVIO',
    'REENVÍO',
    'DEVOLUCION',
    'DEVOLUCIÓN',
    'ENTREGADO',
    // Añadidos tras auditar los 270.292 pedidos del histórico (--estados). Todos estos
    // implican que el pedido ya estaba fuera de la bodega:
    'RECHAZADO',                            // el cliente lo rechazó al recibirlo
    'ENTREGADO A TRANSPORTADORA',
    'ENTREGADA A CONEXIONES',
    'ASIGNADO A ZONA',                      // asignado a zona de reparto
    'ASIGNADO A SUCURSAL DESTINO',
    'EN PUNTO DROOP',                       // esperando al cliente en punto de recogida
    'EN ESPERA DE CITA',                    // esperando cita de entrega
    'CITA PROGRAMADA',                      // cita de entrega ya fijada; detectado 2026-08-24
    'EN ESPERA DE RX',
    'EN PROCESO DE INSPECCION ADUANERA',
    'NOVEDAD SOLUCIONADA',
    'EN PROCESO DE DEVOLUCION',
    'DEVOLUCION EN BODEGA',                 // volvió: para volver tuvo que salir
    'TRANSITO A DEVOLUCION PROVEEDOR',
    'DESTRUCCION - SALVAMENTO - DONACION',  // destino final de una devolución
    'SINIESTRO',                            // se perdió o dañó en tránsito
    'LOST',
    'INDEMNIZADA',
    'INDEMNIZADA POR DROPI',
    'EN PROCESO DE INDEMNIZACION',
    'FACTURADO',
]);

// Todavía en bodega o muerto antes de salir. Se listan para documentar la decisión: no
// basta con "lo que no está en el set de arriba", porque así queda escrito que CANCELADO
// se excluye a propósito y no por olvido.
export const ESTADOS_NO_DESPACHADOS = new Set([
    'PENDIENTE',
    'EN PROCESAMIENTO',
    'EN BODEGA ORIGEN',
    'PREPARADO PARA TRANSPORTADORA',
    'GUIA_GENERADA',
    'GUIA GENERADA',
    'CANCELADO',
    'ANULADO',
    // Añadidos tras la misma auditoría: nunca llegaron a salir.
    'GUIA_ANULADA',                         // la guía se anuló antes de despachar
    'RECOGIDA FALLIDA',                     // la transportadora no logró recogerlo
    'TELEMERCADEO',                         // gestión comercial previa al despacho
    'SIN MOVIMIENTOS',
    'RECEPCION BODEGA',
    'ASIGNADO',
    'EN DESPACHO',                          // en proceso de alistamiento, aún en bodega
]);

export function normalizarEstado(estado?: unknown): string {
    return String(estado || '').trim().toUpperCase();
}

export function yaSalioDeBodega(estado?: unknown): boolean {
    return ESTADOS_DESPACHADOS.has(normalizarEstado(estado));
}

// Estados que no están en ninguna de las dos listas: hay que revisarlos a mano.
export function estadoDesconocido(estado?: unknown): boolean {
    const e = normalizarEstado(estado);
    if (!e) return false;
    return !ESTADOS_DESPACHADOS.has(e) && !ESTADOS_NO_DESPACHADOS.has(e);
}
