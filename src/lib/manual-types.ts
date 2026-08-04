// Modelo del módulo de Capacitación / Manual de uso de la plataforma.
// El contenido vive en Firestore (colección `manuales`) para poder ampliarlo o
// corregirlo sin desplegar: cada guía tiene secciones y cada sección, pasos.

export type ManualAudiencia = 'comercial' | 'logistica' | 'general';

// Una anotación es un número sobre el pantallazo ("1", "2"…) con su explicación.
export type ManualAnotacion = {
    numero: number;
    texto: string;
    // Posición del marcador sobre la imagen, en % del ancho/alto (0-100).
    x?: number;
    y?: number;
    // Texto visible del elemento a señalar: el script de captura lo busca en la
    // pantalla y calcula x/y automáticamente.
    buscar?: string;
};

export type ManualPaso = {
    titulo: string;
    explicacion: string;
    // Para qué sirve / en qué casos se usa (la duda más frecuente del equipo)
    cuandoUsar?: string;
    // Advertencias o errores comunes
    ojo?: string;
    imagenUrl?: string;
    // Ruta de la pantalla (se usa para capturar el pantallazo automáticamente)
    ruta?: string;
    anotaciones?: ManualAnotacion[];
    // Clics previos a la captura (para fotografiar pasos intermedios de un flujo)
    acciones?: Array<{ click?: string; esperar?: number }>;
};

export type ManualSeccion = {
    titulo: string;
    descripcion?: string;
    pasos: ManualPaso[];
};

export type ManualGuia = {
    id?: string;
    slug: string;
    titulo: string;
    descripcion: string;
    audiencia: ManualAudiencia;
    orden: number;
    secciones: ManualSeccion[];
    updatedAt?: number;
};
