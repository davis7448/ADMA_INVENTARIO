// Catálogo del cotizador de maquila.
//
// Vive en código a propósito por ahora: la Fase 1 del plan lo mueve a
// `settings/quoteCatalog` para que se edite sin desplegar. Hasta entonces, este archivo
// es la única fuente y no se copian datos de la referencia externa (direcciones,
// teléfonos ni contactos): eso será configuración propia.

export const CATEGORIAS = [
    { id: 'cosmetico', nombre: 'Cosmético', ejemplos: 'cremas, serums, shampoos, cuidado personal' },
    { id: 'alimento', nombre: 'Alimento', ejemplos: 'polvos, líquidos, gomas, salsas' },
    { id: 'suplemento', nombre: 'Suplemento', ejemplos: 'cápsulas, polvos, gomas, líquidos' },
    { id: 'veterinario', nombre: 'Veterinario', ejemplos: 'shampoo, tópicos, suplementos animales' },
    { id: 'industrial', nombre: 'Industrial / Aseo', ejemplos: 'detergentes, desinfectantes, geles' },
] as const;

export type CategoriaId = (typeof CATEGORIAS)[number]['id'];

// Cosmético admite varias formas; el resto una sola. `aerosol` habilita la casilla de
// presentación en aerosol, que no aplica a alimentos ni suplementos.
export const FORMAS: Record<CategoriaId, { multiple: boolean; aerosol: boolean; opciones: string[] }> = {
    cosmetico: {
        multiple: true, aerosol: true,
        opciones: ['Crema', 'Gel', 'Serum', 'Loción', 'Aceite', 'Bálsamo', 'Mousse', 'Spray', 'Espuma',
            'Mascarilla', 'Shampoo', 'Acondicionador', 'Tónico', 'Exfoliante', 'Pomada', 'Polvo', 'Stick'],
    },
    alimento: { multiple: false, aerosol: false, opciones: ['Polvo', 'Líquido', 'Goma', 'Salsa', 'Snack', 'Otro'] },
    suplemento: { multiple: false, aerosol: false, opciones: ['Líquido', 'Polvo', 'Cápsulas', 'Tabletas', 'Gomas'] },
    veterinario: { multiple: false, aerosol: false, opciones: ['Shampoo', 'Suplemento', 'Tópico', 'Spray', 'Otro'] },
    industrial: { multiple: false, aerosol: true, opciones: ['Líquido', 'Gel', 'Polvo', 'Crema', 'Desinfectante', 'Detergente'] },
};

export const RUTAS_REGULATORIAS: Record<CategoriaId, string[]> = {
    cosmetico: ['Notificación sanitaria', 'No estoy seguro'],
    alimento: ['Registro sanitario', 'Permiso sanitario', 'Notificación sanitaria', 'No estoy seguro'],
    suplemento: ['Registro sanitario', 'Notificación sanitaria', 'No estoy seguro'],
    veterinario: ['Registro ICA', 'Notificación', 'No estoy seguro'],
    industrial: ['Notificación / Concepto', 'No aplica', 'No estoy seguro'],
};

// La tabla nutricional solo tiene sentido en estas dos categorías.
export const CATEGORIAS_CON_TABLA_NUTRICIONAL: CategoriaId[] = ['alimento', 'suplemento'];

export const MODALIDADES = [
    { id: 'full_service', nombre: 'Full Service', detalle: 'El laboratorio aporta materia prima, envase, etiqueta, empaque y mano de obra.' },
    { id: 'mixta', nombre: 'Mixta', detalle: 'Tú aportas parte de los materiales y el laboratorio el resto.' },
] as const;

export const INCLUIDOS_FULL = ['Envase', 'Etiqueta', 'Empaque', 'Diseño gráfico'];
export const APORTES_CLIENTE = ['Materia prima', 'Envase / frasco', 'Etiqueta', 'Empaque secundario'];

export const RUTAS_FORMULACION = [
    { id: 'aporto', nombre: 'Aporto la fórmula', detalle: 'Ya tienes la fórmula y quieres que la fabriquemos.' },
    { id: 'desarrollamos', nombre: 'Desarrollamos la fórmula', detalle: 'Nos cuentas la idea y nuestro equipo la formula.' },
    { id: 'muestra', nombre: 'Envío una muestra física', detalle: 'Tienes un producto de referencia y quieres algo equivalente.' },
] as const;

export const FRAGANCIAS = ['Sin fragancia', 'Natural', 'Frutal', 'Floral', 'Cítrica', 'Neutra', 'Personalizada'];

export const CANALES_VENTA = ['Ecommerce', 'Tienda física', 'Amazon', 'Distribuidores', 'Venta directa', 'Marketplace', 'Otro'];
export const ORIGENES_LEAD = ['Google', 'Instagram', 'Referido', 'Feria', 'Ya somos clientes', 'Otro'];

// Límites de cantidad. El servidor los valida también: no basta con el control deslizante.
export const CANTIDAD = { min: 1000, max: 50000, paso: 500, inicial: 5000 };

// Países tal como los escribe el dropdown PAIS de ClickUp. Se copian literales a
// propósito: si aquí dijera "México" y allá "MEXICO", el emparejado del campo fallaría y
// la tarea llegaría sin país.
export const PAISES = ['COLOMBIA', 'MEXICO', 'ECUADOR', 'PARAGUAY', 'ARGENTINA', 'GUATEMALA', 'CHILE', 'PANAMA'];
