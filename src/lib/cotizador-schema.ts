// Esquema del cotizador, compartido por el formulario y la server action.
//
// La auditoría señalaba que la referencia validaba solo presencia y en el navegador: el
// correo `invalido` habilitaba el envío. Aquí las reglas se declaran una vez y el servidor
// las vuelve a aplicar sobre lo que llega, que es donde cuentan.
import { z } from 'zod';
import { CANTIDAD, CATEGORIAS, CATEGORIAS_CON_TABLA_NUTRICIONAL, FORMAS, PAISES, RUTAS_REGULATORIAS, type CategoriaId } from './cotizador-catalogo';

const texto = (max: number) => z.string().trim().max(max);
const ids = CATEGORIAS.map(c => c.id) as [CategoriaId, ...CategoriaId[]];

export const CotizacionSchema = z.object({
    categoria: z.enum(ids),
    formas: z.array(texto(60)).min(1, 'Elige al menos una forma'),
    // `Otro` sin descripción no dice nada a quien cotiza: en la referencia era opcional.
    formaOtroDetalle: texto(300).optional(),
    esAerosol: z.boolean().default(false),
    aerosolDetalle: texto(300).optional(),

    modalidad: z.enum(['full_service', 'mixta']),
    incluidos: z.array(texto(40)).default([]),
    aportaCliente: z.array(texto(40)).default([]),
    descripcionProducto: texto(1000).optional(),

    rutaFormulacion: z.enum(['aporto', 'desarrollamos', 'muestra']),
    ideaFormulacion: texto(1000).optional(),
    solicitaMejora: z.boolean().default(false),
    ingredientesIncluir: z.array(texto(60)).max(40).default([]),
    ingredientesEvitar: z.array(texto(60)).max(40).default([]),
    fragancia: texto(40).optional(),
    fraganciaDetalle: texto(200).optional(),

    marcaBlanca: z.boolean(),
    rutaRegulatoria: texto(60).optional(),
    tablaNutricional: z.boolean().optional(),
    presentacion: texto(120).min(1, 'Indica la presentación, peso o volumen'),
    // Enlace a un producto de referencia. Es como trabaja el equipo —hay tareas cuya
    // observación entera es "tal cual el link"— y hasta ahora no se pedía.
    // La cadena vacía se acepta para no obligar a limpiar el campo antes de enviar.
    enlaceReferencia: z.union([z.literal(''), z.string().trim().url('El enlace no es válido').max(500)]).optional(),
    cantidad: z.number().int().min(CANTIDAD.min).max(CANTIDAD.max),
    canalesVenta: z.array(texto(40)).default([]),
    origenLead: texto(40).optional(),

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
        if (d.fragancia === 'Personalizada' && !d.fraganciaDetalle) {
            ctx.addIssue({ code: 'custom', path: ['fraganciaDetalle'], message: 'Describe la fragancia que buscas' });
        }
        if (d.rutaRegulatoria && !RUTAS_REGULATORIAS[d.categoria].includes(d.rutaRegulatoria)) {
            ctx.addIssue({ code: 'custom', path: ['rutaRegulatoria'], message: 'Esa ruta regulatoria no corresponde a la categoría' });
        }
        if (d.tablaNutricional !== undefined && !CATEGORIAS_CON_TABLA_NUTRICIONAL.includes(d.categoria)) {
            ctx.addIssue({ code: 'custom', path: ['tablaNutricional'], message: 'La tabla nutricional no aplica a esta categoría' });
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
export function normalizarIngrediente(valor: string): string {
    return valor.trim().replace(/\s+/g, ' ').toLowerCase()
        .replace(/^./, c => c.toUpperCase());
}
