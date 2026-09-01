// Normalización de números de guía.
//
// El pistoleo entrega la guía tal como la imprime la transportadora, pero en Firestore
// quedó guardada con el formato completo. Sin normalizar, una guía recién pistoleada
// nunca cruza con la que está en `dispatchOrders.trackingNumbers`.
//
// Vivía copiada tres veces (la pestaña de búsqueda, la ruta pública /api/dispatch/search-guides
// y la capa de datos). Al estar duplicada, cualquier regla nueva de una transportadora
// tenía que escribirse en tres sitios o la búsqueda daba resultados distintos según por
// dónde entrara. Ahora es un solo módulo: no lleva "use server", así que se puede importar
// desde el navegador y desde el servidor.

export const normalizarGuia = (guia: string): string => {
    const limpia = String(guia ?? '').trim();

    // Interrapidísimo/Envía: las de 11 dígitos que empiezan por '24' se guardan con un '0' delante.
    if (limpia.startsWith('24') && limpia.length === 11) {
        return '0' + limpia;
    }

    // Servientrega: las de 11 dígitos que empiezan por '3' se guardan como 7 + guía + 001.
    if (limpia.startsWith('3') && limpia.length === 11) {
        return '7' + limpia + '001';
    }

    return limpia;
};

// Lo que devuelve la búsqueda de guías por cada guía encontrada. Es deliberadamente
// plano: solo lo que pinta la tabla de resultados. El nombre de plataforma y
// transportadora los resuelve quien consulta, que ya tiene esos catálogos cargados.
export interface DispatchGuideMatch {
    status: string;
    dispatchId: string;
    date: string; // ISO
    platformId: string;
    carrierId: string;
    warehouseId: string | null;
}
