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

// Qué papel juega ADMA en el producto. Lo pidió el laboratorio (2026-09-04): no es lo
// mismo fabricar desde la fórmula que solo envasar un granel del cliente, y la cotización
// y el trámite regulatorio cambian con eso. Es la primera pregunta del paso de
// fabricación; Full Service / Mixta pasa a ser la segunda.
export const ROLES_FABRICACION = [
    { id: 'maquilador', nombre: 'Maquilador', detalle: 'Fabricamos tu producto completo con tu marca.' },
    { id: 'envasador', nombre: 'Envasador', detalle: 'Tú traes el granel y nosotros lo envasamos.' },
    { id: 'acondicionador', nombre: 'Acondicionador', detalle: 'Etiquetamos, empacamos y acondicionamos tu producto terminado.' },
    { id: 'fabricante', nombre: 'Fabricante', detalle: 'Desarrollamos y fabricamos el producto como titulares del proceso.' },
] as const;

export type RolFabricacionId = (typeof ROLES_FABRICACION)[number]['id'];

export const MODALIDADES = [
    { id: 'full_service', nombre: 'Full Service', detalle: 'Nosotros ponemos todo: materia prima, envase, etiqueta, empaque, mano de obra.' },
    { id: 'mixta', nombre: 'Mixta', detalle: 'Tú aportas algunos componentes y nosotros el resto.' },
] as const;

export const INCLUIDOS_FULL = ['Envase', 'Etiqueta', 'Empaque', 'Diseño gráfico'];
export const APORTES_CLIENTE = ['Materia prima', 'Envase / frasco', 'Etiqueta', 'Empaque secundario'];

export const RUTAS_FORMULACION = [
    { id: 'aporto', nombre: 'Aporto fórmula', detalle: 'Ya tienes fórmula desarrollada' },
    { id: 'desarrollamos', nombre: 'Desarrollamos', detalle: 'Creamos desde cero contigo' },
    { id: 'muestra', nombre: 'Enviar muestra', detalle: 'Muestra física a laboratorio' },
] as const;

// Si el cliente aporta la fórmula, sus estudios de estabilidad ahorran trabajo; si no los
// tiene, hay que hacerlos y eso se cobra. Se pregunta explícito para que la cotización
// no se lleve la sorpresa después.
export const ESTUDIOS_ESTABILIDAD = [
    { id: 'tengo', nombre: 'Tengo estudios de estabilidad', detalle: 'Adjúntalos y los tenemos en cuenta.' },
    { id: 'no_tengo', nombre: 'No los tengo', detalle: 'Los realizamos nosotros. Tiene un costo adicional.' },
] as const;

// Proclamas ("claims") que el cliente quiere poder poner en la etiqueta. Cualquier otra
// requiere estudios que la respalden, así que "Otra" obliga a describirla.
export const PROCLAMAS = [
    'Libre de parabenos', 'Libre de sulfatos', 'Libre de siliconas', 'Libre de fenoxietanol',
    'Cruelty free', 'Otra',
];
export const PROCLAMA_OTRA = 'Otra';

// Texto informativo del proceso de estabilidad: el laboratorio quiere que sea explícito
// desde el formulario, no una sorpresa en la cotización.
export const AVISO_ESTABILIDAD =
    'Todo producto pasa por nuestro proceso interno de estabilidad acelerada y natural, y por estudios microbiológicos externos.';

export const FRAGANCIAS = ['Sin fragancia', 'Natural', 'Frutal', 'Floral', 'Cítrica', 'Neutra', 'Personalizada'];

// Envase deseado. Opciones cerradas más "Otro" con texto: el equipo cotiza el envase en
// una etapa propia (COTIZAR ENVASE) y necesita al menos material y tipo.
export const ENVASE_MATERIALES = ['Vidrio', 'PET', 'PEAD', 'Aluminio', 'Laminado / sachet', 'Otro'];
export const ENVASE_TIPOS = ['Frasco', 'Pote / tarro', 'Tubo', 'Airless', 'Sachet', 'Doypack', 'Spray', 'Roll-on', 'Gotero', 'Otro'];
export const ENVASE_OTRO = 'Otro';

// NSO = Notificación Sanitaria Obligatoria. Si el cliente ya la tiene, cambia todo: hay
// que saber si está vigente, si es suya o de otro laboratorio (que no va a compartir la
// fórmula), con qué figura nos añadiría y quién hace el trámite.
export const NSO_TITULARIDAD = [
    { id: 'propia', nombre: 'Es mía' },
    { id: 'otro_laboratorio', nombre: 'Es de otro laboratorio' },
] as const;
export const NSO_ADICIONAR = [
    { id: 'no', nombre: 'No, por ahora no' },
    { id: 'maquilador', nombre: 'Como maquilador' },
    { id: 'envasador', nombre: 'Como envasador' },
    { id: 'acondicionador', nombre: 'Como acondicionador' },
    { id: 'fabricante', nombre: 'Como fabricante' },
] as const;
export const NSO_TRAMITE = [
    { id: 'cliente', nombre: 'Lo hago yo' },
    { id: 'adma', nombre: 'Lo hace ADMA' },
] as const;

// Datos de contacto que muestra el cotizador (botones de WhatsApp y correo de la
// confirmación, dirección para muestras). Vacíos a propósito hasta que el laboratorio
// confirme los reales: el prototipo traía un número y una dirección de ejemplo y no se
// copian. Con el valor vacío, el botón o el bloque no se muestra.
export const CONTACTO_COTIZADOR = {
    whatsapp: '',            // solo dígitos con indicativo, ej. 573001234567
    correoComercial: '',     // ej. comercial@admalab.com
    direccionMuestras: '',   // ej. Cra 32 # 10-24, Acopi Yumbo
    atencionMuestras: '',    // ej. Cotizaciones ADMA
};

export const CANALES_VENTA = ['Ecommerce', 'Tienda física', 'Amazon', 'Distribuidores', 'Venta directa', 'Marketplace', 'Otro'];
export const ORIGENES_LEAD = ['Google', 'Instagram', 'Referido', 'Feria', 'Ya somos clientes', 'Otro'];

// Límites de cantidad. El servidor los valida también: no basta con el control deslizante.
export const CANTIDAD = { min: 1000, max: 50000, paso: 500, inicial: 5000 };

// Países tal como los escribe el dropdown PAIS de ClickUp. Se copian literales a
// propósito: si aquí dijera "México" y allá "MEXICO", el emparejado del campo fallaría y
// la tarea llegaría sin país.
export const PAISES = ['COLOMBIA', 'MEXICO', 'ECUADOR', 'PARAGUAY', 'ARGENTINA', 'GUATEMALA', 'CHILE', 'PANAMA'];
