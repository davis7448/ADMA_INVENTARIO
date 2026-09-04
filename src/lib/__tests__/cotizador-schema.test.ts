import { describe, it, expect } from 'vitest';
import { CotizacionSchema, normalizarIngrediente } from '../cotizador-schema';
import { descripcionCotizacion } from '../clickup-cotizaciones';
import { FUNCIONES_COSING, FUNCIONES_COSING_CLIENTE } from '../cosing-funciones';

// Cotización mínima válida: lo que exige el formulario para poder enviar.
const base = {
    categoria: 'cosmetico', formas: ['Serum'], rolFabricacion: 'maquilador', modalidad: 'full_service',
    rutaFormulacion: 'desarrollamos', marcaBlanca: true, presentacion: '30 ml', cantidad: 5000,
    nombre: 'Prueba', email: 'prueba@ejemplo.com', ciudad: 'Cali',
};

const errores = (datos: object) => {
    const r = CotizacionSchema.safeParse(datos);
    return r.success ? [] : r.error.issues.map(i => i.path.join('.'));
};

describe('esquema V5 — campos nuevos', () => {
    it('acepta la cotización mínima', () => {
        expect(errores(base)).toEqual([]);
    });

    it('exige el rol de fabricación', () => {
        const { rolFabricacion: _r, ...sinRol } = base;
        expect(errores(sinRol)).toContain('rolFabricacion');
    });

    it('al aportar fórmula pide decir si hay estudios de estabilidad', () => {
        expect(errores({ ...base, rutaFormulacion: 'aporto' })).toContain('estudiosEstabilidad');
        expect(errores({ ...base, rutaFormulacion: 'aporto', estudiosEstabilidad: 'no_tengo' })).toEqual([]);
    });

    it('solo admite funciones CoSIng reales y solo en cosméticos', () => {
        expect(errores({ ...base, funcionesCosing: ['MOISTURISING'] })).toEqual([]);
        expect(errores({ ...base, funcionesCosing: ['INVENTADA'] })).toContain('funcionesCosing');
        expect(errores({ ...base, categoria: 'alimento', formas: ['Polvo'], funcionesCosing: ['MOISTURISING'] })).toContain('funcionesCosing');
    });

    it('"Otra" proclama obliga a describirla', () => {
        expect(errores({ ...base, proclamas: ['Otra'] })).toContain('proclamaOtra');
        expect(errores({ ...base, proclamas: ['Libre de parabenos', 'Otra'], proclamaOtra: 'Vegano' })).toEqual([]);
        expect(errores({ ...base, proclamas: ['Sin gluten'] })).toContain('proclamas');
    });

    it('envase "Otro" obliga a describirlo', () => {
        expect(errores({ ...base, envaseTipo: 'Otro' })).toContain('envaseDetalle');
        expect(errores({ ...base, envaseMaterial: 'Vidrio', envaseTipo: 'Gotero' })).toEqual([]);
    });

    it('con NSO exige número, vigencia, titularidad y adición; el trámite solo si se adiciona', () => {
        expect(errores({ ...base, tieneRegistro: true })).toEqual(expect.arrayContaining(['nsoNumero', 'nsoVigente', 'nsoTitularidad', 'nsoAdicionar']));
        const conNso = { ...base, tieneRegistro: true, nsoNumero: 'NSOC1', nsoVigente: true, nsoTitularidad: 'propia' };
        expect(errores({ ...conNso, nsoAdicionar: 'no' })).toEqual([]);
        expect(errores({ ...conNso, nsoAdicionar: 'maquilador' })).toContain('nsoTramite');
        expect(errores({ ...conNso, nsoAdicionar: 'maquilador', nsoTramite: 'adma' })).toEqual([]);
    });

    it('sin NSO no pide nada del bloque', () => {
        expect(errores({ ...base, tieneRegistro: false })).toEqual([]);
    });
});

describe('ingredientes INCI', () => {
    it('normaliza a mayúsculas y colapsa espacios', () => {
        expect(normalizarIngrediente('  aloe barbadensis   leaf juice ')).toBe('ALOE BARBADENSIS LEAF JUICE');
    });
});

describe('catálogo CoSIng', () => {
    it('trae las 83 funciones del documento, con un subconjunto para el cliente', () => {
        expect(FUNCIONES_COSING).toHaveLength(83);
        expect(new Set(FUNCIONES_COSING.map(f => f.id)).size).toBe(83);
        expect(FUNCIONES_COSING_CLIENTE.length).toBeGreaterThan(10);
        expect(FUNCIONES_COSING_CLIENTE.length).toBeLessThan(FUNCIONES_COSING.length);
    });
});

describe('descripción para ClickUp', () => {
    it('lleva los datos nuevos con nombres legibles', () => {
        const q = {
            ...base, marca: 'Luma', rolFabricacion: 'envasador', estudiosEstabilidad: 'no_tengo', rutaFormulacion: 'aporto',
            funcionesCosing: ['MOISTURISING'], proclamas: ['Otra'], proclamaOtra: 'Vegano',
            envaseMaterial: 'Vidrio', envaseTipo: 'Gotero', variantesColor: '2 tonos',
            tieneRegistro: true, nsoNumero: 'NSOC1', nsoVigente: false, nsoTitularidad: 'otro_laboratorio', nsoAdicionar: 'envasador', nsoTramite: 'adma',
            ingredientesIncluir: ['NIACINAMIDE'],
        };
        const t = descripcionCotizacion(q, 'COT-2026-0001');
        expect(t).toContain('**Marca:** Luma');
        expect(t).toContain('Rol de ADMA:** Envasador');
        expect(t).toContain('Estudios de estabilidad: No los tengo');
        expect(t).toContain('Hidratante (MOISTURISING)');
        expect(t).toContain('Proclamas: Otra — otra: Vegano');
        expect(t).toContain('Envase: Vidrio / Gotero');
        expect(t).toContain('Variantes de color: 2 tonos');
        expect(t).toContain('NSO:** NSOC1 · NO vigente · Es de otro laboratorio · adicionar a ADMA como envasador · trámite: Lo hace ADMA');
        expect(t).toContain('Ingredientes a incluir (INCI): NIACINAMIDE');
    });

    it('marca cuando el cliente desmarcó el aviso de estabilidad', () => {
        expect(descripcionCotizacion({ ...base, aceptaEstabilidad: false }, 'COT-1')).toContain('desmarcó el aviso');
        expect(descripcionCotizacion({ ...base, aceptaEstabilidad: true }, 'COT-1')).not.toContain('desmarcó');
    });
});
