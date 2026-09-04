import { describe, it, expect } from 'vitest';
import { telefonoE164, notaCotizacion, urlConversacionChatwoot } from '../chatwoot-cotizaciones';

describe('teléfono a E.164', () => {
    it('celular colombiano de diez dígitos', () => {
        expect(telefonoE164('300 123 4567')).toBe('+573001234567');
        expect(telefonoE164('3001234567')).toBe('+573001234567');
    });
    it('ya con indicativo, con o sin +', () => {
        expect(telefonoE164('+57 300 123 4567')).toBe('+573001234567');
        expect(telefonoE164('573001234567')).toBe('+573001234567');
    });
    it('otros países se respetan tal cual', () => {
        expect(telefonoE164('+52 55 1234 5678')).toBe('+525512345678');
    });
    it('vacío o demasiado corto no vale', () => {
        expect(telefonoE164('')).toBeNull();
        expect(telefonoE164(undefined)).toBeNull();
        expect(telefonoE164('12345')).toBeNull();
    });
});

describe('nota privada para el buzón de Lab', () => {
    const q = {
        nombre: 'Ana', empresa: 'Luma', marca: 'Luma Skin', email: 'ana@ejemplo.com', telefono: '3001234567', ciudad: 'Cali', pais: 'COLOMBIA',
        categoria: 'cosmetico', formas: ['Serum'], presentacion: '30 ml', cantidad: 5000,
        rolFabricacion: 'maquilador', modalidad: 'full_service', rutaFormulacion: 'aporto', estudiosEstabilidad: 'no_tengo',
        tieneRegistro: true, nsoNumero: 'NSOC1', nsoVigente: true, mensaje: 'Urgente',
    };
    it('lleva referencia, cliente, producto, fabricación, NSO, mensaje y enlace a la bandeja', () => {
        const n = notaCotizacion(q, 'COT-2026-0007');
        expect(n).toContain('COT-2026-0007');
        expect(n).toContain('Ana · Luma · marca Luma Skin · ana@ejemplo.com · 3001234567 · Cali (COLOMBIA)');
        expect(n).toContain('Cosmético · Serum · 30 ml · 5.000 unidades');
        expect(n).toContain('Maquilador · Full Service · fórmula: Aporto fórmula · sin estudios de estabilidad (costo adicional)');
        expect(n).toContain('NSO:** NSOC1 · vigente');
        expect(n).toContain('Mensaje:** Urgente');
        expect(n).toContain('https://inv.admacompany.com/cotizaciones');
    });
    it('sin NSO ni mensaje no deja líneas vacías de más', () => {
        const n = notaCotizacion({ ...q, tieneRegistro: false, mensaje: '' }, 'COT-1');
        expect(n).not.toContain('NSO');
        expect(n).not.toContain('Mensaje');
    });
});

describe('enlace a la conversación', () => {
    it('apunta a la cuenta 1 de crm.admacompany.com', () => {
        expect(urlConversacionChatwoot(474)).toBe('https://crm.admacompany.com/app/accounts/1/conversations/474');
    });
});
