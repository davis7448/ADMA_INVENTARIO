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

// ─────────────────────────────────────────────────────────────────────────────
// DIVISAS
//
// El importe de una venta está en la moneda del país donde se vendió. Hasta que
// entró Panamá todo era Colombia y `total` podía tratarse como un número suelto;
// al sumar dólares con pesos el ingreso de enero pasó a decir 65.562.199,5, que
// son 65.561.650 COP + 549,5 USD. Ese número no significa nada.
//
// Regla: los importes NO se convierten (haría falta administrar tasas de cambio y
// los históricos cambiarían de valor con ellas). Se acumulan por moneda y se
// muestran por separado.
export const MONEDA_POR_PAIS: Record<Pais, string> = {
    ARGENTINA: 'ARS',
    CHILE: 'CLP',
    COLOMBIA: 'COP',
    ECUADOR: 'USD',   // dolarizado
    GUATEMALA: 'GTQ',
    MEXICO: 'MXN',
    PANAMA: 'USD',    // el balboa está a la par y Dropi PA reporta en USD
    PARAGUAY: 'PYG',
    PERU: 'PEN',
    'REPUBLICA DOMINICANA': 'DOP',
    URUGUAY: 'UYU',
};

// Las 308k ventas históricas son todas de Colombia y se guardaron sin moneda:
// leer un registro sin `moneda` como COP es correcto y evita reescribirlas.
export const MONEDA_POR_DEFECTO = 'COP';

export function monedaDePais(pais?: string | null): string {
    if (!pais) return MONEDA_POR_DEFECTO;
    const k = pais.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
    return MONEDA_POR_PAIS[k as Pais] || MONEDA_POR_DEFECTO;
}

// Importes acumulados por moneda: { COP: 65561650, USD: 549.5 }
export type Importes = Record<string, number>;

export function sumarImporte(destino: Importes, moneda: string, valor: number): void {
    if (!valor) return;
    destino[moneda] = (destino[moneda] || 0) + valor;
}

export function sumarImportes(destino: Importes, origen?: Importes | null): void {
    for (const [moneda, valor] of Object.entries(origen || {})) {
        destino[moneda] = (destino[moneda] || 0) + (Number(valor) || 0);
    }
}

// Lee un bucket de agregado tolerando el formato viejo (`total: number`, siempre
// pesos colombianos). Sin esto, los meses ya guardados mostrarían 0.
export function leerImportes(bucket?: { totales?: Importes; total?: number } | null): Importes {
    if (!bucket) return {};
    if (bucket.totales) return { ...bucket.totales };
    if (typeof bucket.total === 'number' && bucket.total !== 0) return { [MONEDA_POR_DEFECTO]: bucket.total };
    return {};
}

const SIN_DECIMALES = new Set(['COP', 'CLP', 'PYG']);

export function formatearImporte(valor: number, moneda: string): string {
    const decimales = SIN_DECIMALES.has(moneda) ? 0 : 2;
    return `${valor.toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} ${moneda}`;
}

// "65.561.650 COP · 549,50 USD". Nunca colapsa a un solo número: si hay varias
// monedas, se ven todas.
export function formatearImportes(importes?: Importes | null): string {
    const entradas = Object.entries(importes || {}).filter(([, v]) => v);
    if (entradas.length === 0) return '0';
    return entradas
        .sort((a, b) => b[1] - a[1])
        .map(([moneda, valor]) => formatearImporte(valor, moneda))
        .join(' · ');
}
