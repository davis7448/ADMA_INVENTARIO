import { describe, it, expect } from 'vitest';
import {
    correosDe,
    correoPrincipal,
    itemIdDe,
    esEfectiva,
    quedaPrivado,
    ultimaPorItem,
    resolverVigentes,
    construirHistorial,
    type ModRegistro,
} from '../privatizaciones';

// Fábrica mínima: solo los campos que la lógica mira.
const mod = (campos: Partial<ModRegistro> & { id: string }): ModRegistro =>
    ({ FECHA: null, ID: null, ...campos }) as ModRegistro;

describe('normalización del dato (trampas 1-3)', () => {
    it('parte CORREO_CODIGO con varios correos y los normaliza', () => {
        expect(correosDe({ CORREO_CODIGO: ' A@X.com, b@x.com ' } as any)).toEqual(['a@x.com', 'b@x.com']);
    });

    it('manda el primer correo de la lista', () => {
        expect(correoPrincipal({ CORREO_CODIGO: 'A@X.com, b@x.com' } as any)).toBe('a@x.com');
    });

    it('suma customerEmail sin duplicar', () => {
        expect(correosDe({ CORREO_CODIGO: 'a@x.com', customerEmail: 'A@X.com' } as any)).toEqual(['a@x.com']);
    });

    it('trata "1234567.0" y 1234567 como el mismo ID', () => {
        expect(itemIdDe({ ID: '1234567.0' } as any)).toBe('1234567');
        expect(itemIdDe({ ID: 1234567 } as any)).toBe('1234567');
    });

    it('devuelve null cuando no hay ID', () => {
        expect(itemIdDe({ ID: null } as any)).toBeNull();
        expect(itemIdDe({} as any)).toBeNull();
    });
});

describe('estado de la solicitud (trampa 5)', () => {
    it('cuenta los estados que tocaron la plataforma', () => {
        for (const estado of ['aprobado', 'creado', 'completado']) {
            expect(esEfectiva({ estadoSolicitud: estado } as any)).toBe(true);
        }
    });

    it('descarta lo que no llegó a aplicarse', () => {
        for (const estado of ['pendiente', 'en_revision', 'rechazado']) {
            expect(esEfectiva({ estadoSolicitud: estado } as any)).toBe(false);
        }
    });

    it('trata los registros históricos sin estado como efectivos', () => {
        expect(esEfectiva({} as any)).toBe(true);
    });
});

describe('¿queda privado?', () => {
    it('la acción explícita manda sobre PRIVADO_PUBLICO', () => {
        expect(quedaPrivado({ ACCION_PRIVATIZACION: 'privatizar', PRIVADO_PUBLICO: 'Publico' } as any)).toBe(true);
        expect(quedaPrivado({ ACCION_PRIVATIZACION: 'quitar_privatizacion', PRIVADO_PUBLICO: 'Privado' } as any)).toBe(false);
    });

    it('cae en PRIVADO_PUBLICO cuando no hay acción, tolerando tildes', () => {
        expect(quedaPrivado({ PRIVADO_PUBLICO: 'Privado' } as any)).toBe(true);
        expect(quedaPrivado({ PRIVADO_PUBLICO: 'privado' } as any)).toBe(true);
        expect(quedaPrivado({ PRIVADO_PUBLICO: 'Público' } as any)).toBe(false);
        expect(quedaPrivado({ PRIVADO_PUBLICO: 'Publico' } as any)).toBe(false);
        expect(quedaPrivado({} as any)).toBe(false);
    });
});

describe('estado vigente (trampa 6)', () => {
    const historia: ModRegistro[] = [
        mod({ id: 'm1', ID: 900, FECHA: 1_000, CORREO_CODIGO: 'ana@x.com', ACCION_PRIVATIZACION: 'privatizar', 'CANTIDAD SOLICITADA': 50 } as any),
        mod({ id: 'm2', ID: 900, FECHA: 2_000, CORREO_CODIGO: 'ana@x.com', ACCION_PRIVATIZACION: 'privatizar', 'CANTIDAD SOLICITADA': 25 } as any),
        mod({ id: 'm3', ID: 900, FECHA: 3_000, CORREO_CODIGO: 'ana@x.com', ACCION_PRIVATIZACION: 'quitar_privatizacion' } as any),
        mod({ id: 'm4', ID: 900, FECHA: 4_000, CORREO_CODIGO: 'beto@x.com', ACCION_PRIVATIZACION: 'privatizar', 'CANTIDAD SOLICITADA': 10 } as any),
    ];

    it('se queda con la última modificación de cada ID', () => {
        expect(ultimaPorItem(historia).get('900')?.id).toBe('m4');
    });

    it('atribuye el ID al dueño actual, no al anterior', () => {
        expect(resolverVigentes(historia, ['ana@x.com'])).toEqual([]);

        const deBeto = resolverVigentes(historia, ['beto@x.com']);
        expect(deBeto).toHaveLength(1);
        expect(deBeto[0].itemId).toBe('900');
    });

    it('suma solo las unidades del dueño actual', () => {
        // Las 75 unidades de Ana no se cuentan en la privatización de Beto.
        expect(resolverVigentes(historia, ['beto@x.com'])[0].unidades).toBe(10);
    });

    it('deja de estar vigente si la última acción fue liberarlo', () => {
        expect(resolverVigentes(historia.slice(0, 3))).toEqual([]);
    });

    it('ignora las solicitudes no efectivas al decidir el estado', () => {
        const conRechazo = [
            ...historia,
            mod({ id: 'm5', ID: 900, FECHA: 5_000, ACCION_PRIVATIZACION: 'quitar_privatizacion', estadoSolicitud: 'rechazado' } as any),
        ];
        expect(resolverVigentes(conRechazo, ['beto@x.com'])).toHaveLength(1);
    });

    it('una FECHA nula nunca gana a una fechada', () => {
        const conNula = [
            mod({ id: 'm6', ID: 901, FECHA: null, CORREO_CODIGO: 'ana@x.com', ACCION_PRIVATIZACION: 'quitar_privatizacion' } as any),
            mod({ id: 'm7', ID: 901, FECHA: 10, CORREO_CODIGO: 'ana@x.com', ACCION_PRIVATIZACION: 'privatizar' } as any),
        ];
        expect(resolverVigentes(conNula, ['ana@x.com'])).toHaveLength(1);
    });

    it('sin filtro de correo devuelve todas las vigentes', () => {
        expect(resolverVigentes(historia).map(v => v.itemId)).toEqual(['900']);
    });
});

describe('historial', () => {
    it('ordena de la más reciente a la más antigua y marca las no efectivas', () => {
        const eventos = construirHistorial([
            mod({ id: 'a', ID: 1, FECHA: 1_000 } as any),
            mod({ id: 'b', ID: 1, FECHA: 3_000, estadoSolicitud: 'rechazado' } as any),
            mod({ id: 'c', ID: 1, FECHA: 2_000 } as any),
        ]);
        expect(eventos.map(e => e.modificacionId)).toEqual(['b', 'c', 'a']);
        expect(eventos[0].efectiva).toBe(false);
        expect(eventos[1].efectiva).toBe(true);
    });

    it('lee el SKU aunque la clave lleve espacio final', () => {
        const [evento] = construirHistorial([mod({ id: 'a', 'SKU ': 'ABC-1' } as any)]);
        expect(evento.sku).toBe('ABC-1');
    });
});
