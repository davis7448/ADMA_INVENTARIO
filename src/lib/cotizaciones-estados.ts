// Estados y transiciones de las cotizaciones de maquila.
//
// Viven aquí y no en `app/actions/cotizaciones.ts` porque ese fichero es "use server", y
// Next solo admite exportaciones de funciones async: al encontrar un objeto lanza
// «A "use server" file can only export async functions, found object.» al cargar el
// módulo. Eso dejaba /cotizaciones respondiendo 500 en producción mientras el alta
// pública seguía funcionando. Como el componente de la bandeja es "use client" y
// necesita estas dos tablas, tienen que salir de un módulo normal.
export type EstadoCotizacion =
    | 'recibida' | 'triage' | 'esperando_cliente' | 'revision_tecnica'
    | 'cotizada' | 'aceptada' | 'rechazada' | 'cancelada';

export const ESTADO_LABEL: Record<EstadoCotizacion, string> = {
    recibida: 'Recibida',
    triage: 'En clasificación',
    esperando_cliente: 'Esperando al cliente',
    revision_tecnica: 'Revisión técnica',
    cotizada: 'Cotizada',
    aceptada: 'Aceptada',
    rechazada: 'Rechazada',
    cancelada: 'Cancelada',
};

// Qué transiciones son válidas. Sin esto, un estado puede saltar a cualquier otro y el
// historial deja de contar una historia coherente.
export const TRANSICIONES: Record<EstadoCotizacion, EstadoCotizacion[]> = {
    recibida: ['triage', 'cancelada'],
    triage: ['esperando_cliente', 'revision_tecnica', 'cotizada', 'cancelada'],
    esperando_cliente: ['triage', 'cancelada'],
    revision_tecnica: ['cotizada', 'esperando_cliente', 'cancelada'],
    cotizada: ['aceptada', 'rechazada', 'esperando_cliente'],
    aceptada: [],
    rechazada: [],
    cancelada: [],
};
