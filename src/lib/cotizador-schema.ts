// Esquema del cotizador, compartido por el formulario y la server action.
//
// La auditoría señalaba que la referencia validaba solo presencia y en el navegador: el
// correo `invalido` habilitaba el envío. Aquí las reglas se declaran una vez y el servidor
// las vuelve a aplicar sobre lo que llega, que es donde cuentan.
//
// Versión V5 (2026-09-04): añade rol de fabricación, estudios de estabilidad, funciones
// CoSIng, proclamas, marca, variantes de color, envase y el bloque de NSO. Los campos
// anteriores no cambian de nombre para no romper las cotizaciones ya guardadas.
import { z } from 'zod';
import {
    CANTIDAD, CATEGORIAS, CATEGORIAS_CON_TABLA_NUTRICIONAL, ENVASE_MATERIALES, ENVASE_OTRO,
    ENVASE_TIPOS, FORMAS, PAISES, PROCLAMAS, PROCLAMA_OTRA, RUTAS_REGULATORIAS, type CategoriaId,
} from './cotizador-catalogo';
import { esFuncionCosing } from './cosing-funciones';

const texto = (max: number) => z.string().trim().max(max);
const ids = CATEGORIAS.map(c => c.id) as [CategoriaId, ...CategoriaId[]];

export const ROLES = ['maquilador', 'envasador', 'acondicionador', 'fabricante'] as const;

export const CotizacionSchema = z.object({
    categoria: z.enum(ids),
    formas: z.array(texto(60)).min(1, 'Elige al menos una forma'),
    // `Otro` sin descripción no dice nada a quien cotiza: en la referencia era opcional.
    formaOtroDetalle: texto(300).optional(),
    esAerosol: z.boolean().default(false),
    aerosolDetalle: texto(300).optional(),

    // Paso "Modalidad de fabricación": primero el rol de ADMA, luego Full Service / Mixta.
    rolFabricacion: z.enum(ROLES, { errorMap: () => ({ message: 'Elige qué papel tendrá ADMA' }) }),
    modalidad: z.enum(['full_service', 'mixta']),
    incluidos: z.array(texto(40)).default([]),
    aportaCliente: z.array(texto(40)).default([]),
    descripcionProducto: texto(1000).optional(),

    rutaFormulacion: z.enum(['aporto', 'desarrollamos', 'muestra']),
    // Solo cuando aporta la fórmula. "No los tengo" es un costo adicional y por eso se
    // pregunta en vez de asumirlo.
    estudiosEstabilidad: z.enum(['tengo', 'no_tengo']).optional(),
    ideaFormulacion: texto(1000).optional(),
    // Funciones CoSIng elegidas en "Desarrollamos" (ids oficiales en inglés). Reemplaza
    // la idea libre como dato principal en cosméticos: lo avalado es lo cotizable.
    funcionesCosing: z.array(texto(60)).max(20, 'Elige como máximo 20 funciones').default([]),
    solicitaMejora: z.boolean().default(false),
    // En nomenclatura INCI: se pide así en el formulario, pero no se puede validar más
    // que la longitud.
    ingredientesIncluir: z.array(texto(80)).max(40).default([]),
    ingredientesEvitar: z.array(texto(80)).max(40).default([]),
    proclamas: z.array(texto(60)).default([]),
    proclamaOtra: texto(300).optional(),
    fragancia: texto(40).optional(),
    fraganciaDetalle: texto(200).optional(),
    // Aviso del proceso de estabilidad y microbiología: el cliente confirma que lo leyó.
    aceptaEstabilidad: z.boolean().default(true),

    marcaBlanca: z.boolean(),
    marca: texto(120).optional(),
    rutaRegulatoria: texto(60).optional(),
    tablaNutricional: z.boolean().optional(),
    presentacion: texto(120).min(1, 'Indica la presentación, peso o volumen'),
    variantesColor: texto(300).optional(),
    envaseMaterial: texto(60).optional(),
    envaseTipo: texto(60).optional(),
    envaseDetalle: texto(300).optional(),
    // Enlace a un producto de referencia. Es como trabaja el equipo —hay tareas cuya
    // observación entera es "tal cual el link"— y hasta ahora no se pedía.
    // La cadena vacía se acepta para no obligar a limpiar el campo antes de enviar.
    enlaceReferencia: z.union([z.literal(''), z.string().trim().url('El enlace no es válido').max(500)]).optional(),
    cantidad: z.number().int().min(CANTIDAD.min).max(CANTIDAD.max),
    canalesVenta: z.array(texto(40)).default([]),
    origenLead: texto(40).optional(),

    // Bloque NSO (Notificación Sanitaria Obligatoria). Solo se pregunta si ya la tiene.
    tieneRegistro: z.boolean().optional(),
    nsoNumero: texto(60).optional(),
    nsoVigente: z.boolean().optional(),
    nsoTitularidad: z.enum(['propia', 'otro_laboratorio']).optional(),
    nsoAdicionar: z.enum(['no', ...ROLES]).optional(),
    nsoTramite: z.enum(['cliente', 'adma']).optional(),

    nombre: texto(120).min(2, 'Escribe tu nombre'),
    empresa: texto(120).optional(),
    email: z.string().trim().toLowerCase().email('Correo inválido'),
    telefono: texto(30).optional(),
    ciudad: texto(80).min(2, 'Indica la ciudad de entrega'),
    // Separado de la ciudad: ClickUp tiene un dropdown de país y la ciudad sola no basta
    // para llenarlo.
    pais: texto(40).optional(),
    mensaje: texto(1500).optional(),
    confidencialidad: z.boolean().default(true),
    pilotoSolicitado: z.boolean().default(true),
})
    // Reglas que dependen de más de un campo. La referencia no tenía ninguna: dejaba
    // avanzar con "Otro" sin explicar, aerosoles en alimentos y fragancia personalizada
    // sin describir.
    .superRefine((d, ctx) => {
        const conf = FORMAS[d.categoria];
        if (!conf.multiple && d.formas.length > 1) {
            ctx.addIssue({ code: 'custom', path: ['formas'], message: 'Esta categoría admite una sola forma' });
        }
        for (const f of d.formas) {
            if (!conf.opciones.includes(f)) {
                ctx.addIssue({ code: 'custom', path: ['formas'], message: `"${f}" no es una forma válida para esta categoría` });
            }
        }
        if (d.formas.includes('Otro') && !d.formaOtroDetalle) {
            ctx.addIssue({ code: 'custom', path: ['formaOtroDetalle'], message: 'Describe a qué te refieres con "Otro"' });
        }
        if (d.esAerosol && !conf.aerosol) {
            ctx.addIssue({ code: 'custom', path: ['esAerosol'], message: 'El aerosol no aplica a esta categoría' });
        }
        if (d.rutaFormulacion === 'aporto' && !d.estudiosEstabilidad) {
            ctx.addIssue({ code: 'custom', path: ['estudiosEstabilidad'], message: 'Indica si tienes estudios de estabilidad' });
        }
        for (const f of d.funcionesCosing) {
            if (!esFuncionCosing(f)) {
                ctx.addIssue({ code: 'custom', path: ['funcionesCosing'], message: `"${f}" no es una función CoSIng` });
            }
        }
        if (d.funcionesCosing.length && d.categoria !== 'cosmetico') {
            ctx.addIssue({ code: 'custom', path: ['funcionesCosing'], message: 'Las funciones CoSIng solo aplican a cosméticos' });
        }
        for (const p of d.proclamas) {
            if (!PROCLAMAS.includes(p)) {
                ctx.addIssue({ code: 'custom', path: ['proclamas'], message: `"${p}" no está entre las proclamas` });
            }
        }
        if (d.proclamas.includes(PROCLAMA_OTRA) && !d.proclamaOtra) {
            ctx.addIssue({ code: 'custom', path: ['proclamaOtra'], message: 'Describe la proclama que buscas' });
        }
        if (d.fragancia === 'Personalizada' && !d.fraganciaDetalle) {
            ctx.addIssue({ code: 'custom', path: ['fraganciaDetalle'], message: 'Describe la fragancia que buscas' });
        }
        if (d.rutaRegulatoria && !RUTAS_REGULATORIAS[d.categoria].includes(d.rutaRegulatoria)) {
            ctx.addIssue({ code: 'custom', path: ['rutaRegulatoria'], message: 'Esa ruta regulatoria no corresponde a la categoría' });
        }
        if (d.tablaNutricional !== undefined && !CATEGORIAS_CON_TABLA_NUTRICIONAL.includes(d.categoria)) {
            ctx.addIssue({ code: 'custom', path: ['tablaNutricional'], message: 'La tabla nutricional no aplica a esta categoría' });
        }
        if (d.envaseMaterial && !ENVASE_MATERIALES.includes(d.envaseMaterial)) {
            ctx.addIssue({ code: 'custom', path: ['envaseMaterial'], message: 'Ese material no está en la lista' });
        }
        if (d.envaseTipo && !ENVASE_TIPOS.includes(d.envaseTipo)) {
            ctx.addIssue({ code: 'custom', path: ['envaseTipo'], message: 'Ese tipo de envase no está en la lista' });
        }
        if ((d.envaseMaterial === ENVASE_OTRO || d.envaseTipo === ENVASE_OTRO) && !d.envaseDetalle) {
            ctx.addIssue({ code: 'custom', path: ['envaseDetalle'], message: 'Describe el envase que buscas' });
        }
        if (d.tieneRegistro) {
            if (!d.nsoNumero) ctx.addIssue({ code: 'custom', path: ['nsoNumero'], message: 'Escribe el número de la NSO' });
            if (d.nsoVigente === undefined) ctx.addIssue({ code: 'custom', path: ['nsoVigente'], message: 'Indica si la NSO está vigente' });
            if (!d.nsoTitularidad) ctx.addIssue({ code: 'custom', path: ['nsoTitularidad'], message: 'Indica si la NSO es tuya o de otro laboratorio' });
            if (!d.nsoAdicionar) ctx.addIssue({ code: 'custom', path: ['nsoAdicionar'], message: 'Indica si nos vas a adicionar en la NSO' });
            if (d.nsoAdicionar && d.nsoAdicionar !== 'no' && !d.nsoTramite) {
                ctx.addIssue({ code: 'custom', path: ['nsoTramite'], message: 'Indica quién hace el trámite' });
            }
        }
        if (d.pais && !PAISES.includes(d.pais)) {
            ctx.addIssue({ code: 'custom', path: ['pais'], message: 'Ese país no está en la lista' });
        }
        if (d.cantidad % CANTIDAD.paso !== 0) {
            ctx.addIssue({ code: 'custom', path: ['cantidad'], message: `La cantidad debe ir de ${CANTIDAD.paso} en ${CANTIDAD.paso}` });
        }
    });

export type CotizacionInput = z.input<typeof CotizacionSchema>;
export type Cotizacion = z.output<typeof CotizacionSchema>;

// Normaliza un ingrediente: la referencia guardaba "Aloe", "aloe " y " ALOE" como tres.
// Los nombres INCI van en mayúsculas por convención (AQUA, GLYCERIN, ALOE BARBADENSIS
// LEAF JUICE), así que se guardan así.
export function normalizarIngrediente(valor: string): string {
    return valor.trim().replace(/\s+/g, ' ').toUpperCase();
}
