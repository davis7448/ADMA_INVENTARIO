// Países donde opera ADMA. Fuente única: antes la lista estaba duplicada en
// modificaciones-content, solicitudes-content y ventas-plataformas-content, con el
// riesgo de que se desincronizaran.
export const PAISES = ['COLOMBIA', 'MEXICO', 'ECUADOR', 'PARAGUAY', 'ARGENTINA', 'GUATEMALA'] as const;

export type Pais = (typeof PAISES)[number];

const BANDERAS: Record<string, string> = {
    COLOMBIA: '🇨🇴',
    MEXICO: '🇲🇽',
    ECUADOR: '🇪🇨',
    PARAGUAY: '🇵🇾',
    ARGENTINA: '🇦🇷',
    GUATEMALA: '🇬🇹',
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
