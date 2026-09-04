// Estado compartido entre los pasos del cotizador V5.
//
// Los ficheros no caben en el estado del formulario (no son serializables): viajan
// aparte, en una segunda llamada, una vez la cotización ya tiene id. Se agrupan por
// tipo para que en ClickUp se distinga la fórmula de la inspiración: al enviarlos se
// renombran con el prefijo del grupo.
import { CANTIDAD } from '@/lib/cotizador-catalogo';
import type { CotizacionInput } from '@/lib/cotizador-schema';

export type Datos = Partial<CotizacionInput>;

export type GrupoArchivo = 'inspiracion' | 'formula' | 'estabilidad' | 'referencias';
export type Archivos = Record<GrupoArchivo, File[]>;

export const ARCHIVOS_VACIOS: Archivos = { inspiracion: [], formula: [], estabilidad: [], referencias: [] };

export const PREFIJO_ARCHIVO: Record<GrupoArchivo, string> = {
    inspiracion: 'INSPIRACION', formula: 'FORMULA', estabilidad: 'ESTABILIDAD', referencias: 'REFERENCIA',
};

export const INICIAL: Datos = {
    formas: [], incluidos: ['Envase', 'Etiqueta'], aportaCliente: [],
    ingredientesIncluir: [], ingredientesEvitar: [], funcionesCosing: [], proclamas: [],
    canalesVenta: ['Ecommerce'], cantidad: CANTIDAD.inicial,
    esAerosol: false, solicitaMejora: false, aceptaEstabilidad: true,
    confidencialidad: true, pilotoSolicitado: true, fragancia: 'Natural',
};

export type PasoProps = {
    d: Datos;
    set: (k: keyof CotizacionInput, v: unknown) => void;
    errores: Record<string, string>;
    archivos: Archivos;
    setArchivos: (grupo: GrupoArchivo, ficheros: File[]) => void;
};

// Alterna un valor dentro de un campo de lista.
export function alternar(lista: string[] | undefined, valor: string): string[] {
    const a = lista || [];
    return a.includes(valor) ? a.filter(x => x !== valor) : [...a, valor];
}

export const PASOS = [
    { id: 0, label: 'Categoría', desc: 'Tipo de producto' },
    { id: 1, label: 'Forma', desc: 'Presentación' },
    { id: 2, label: 'Fabricación', desc: 'Modalidad' },
    { id: 3, label: 'Formulación', desc: 'Desarrollo' },
    { id: 4, label: 'Detalles', desc: 'Técnicos' },
    { id: 5, label: 'Cierre', desc: 'Entrega' },
] as const;
