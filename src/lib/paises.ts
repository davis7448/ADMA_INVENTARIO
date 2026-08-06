// Países donde opera ADMA. Fuente única: antes la lista estaba duplicada en
// modificaciones-content, solicitudes-content y ventas-plataformas-content, con el
// riesgo de que se desincronizaran.
// En MAYÚSCULAS y sin tildes: es el formato con el que ya se guardan el país de las
// ventas y de las solicitudes, y con el que se agrupan los reportes. Cambiarlo
// partiría los datos históricos en dos ("COLOMBIA" vs "Colombia").
export const PAISES = [
    'ARGENTINA', 'CHILE', 'COLOMBIA', 'ECUADOR', 'GUATEMALA', 'MEXICO',
    'PANAMA', 'PARAGUAY', 'PERU', 'REPUBLICA DOMINICANA', 'URUGUAY',
] as const;

export type Pais = (typeof PAISES)[number];

const BANDERAS: Record<string, string> = {
    ARGENTINA: '🇦🇷',
    CHILE: '🇨🇱',
    COLOMBIA: '🇨🇴',
    ECUADOR: '🇪🇨',
    GUATEMALA: '🇬🇹',
    MEXICO: '🇲🇽',
    PANAMA: '🇵🇦',
    PARAGUAY: '🇵🇾',
    PERU: '🇵🇪',
    'REPUBLICA DOMINICANA': '🇩🇴',
    URUGUAY: '🇺🇾',
};

// Bandera del país (tolera tildes, minúsculas y espacios: "México" → 🇲🇽)
export function banderaPais(pais?: string | null): string {
    if (!pais) return '';
    const k = pais.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
    return BANDERAS[k] || '🏳️';
}

// Etiqueta con bandera, lista para pintar: "🇪🇨 ECUADOR"
export function etiquetaPais(pais?: string | null): string {
    if (!pais) return '';
    return `${banderaPais(pais)} ${pais}`.trim();
}
