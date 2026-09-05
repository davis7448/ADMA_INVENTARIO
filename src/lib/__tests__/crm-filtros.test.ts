import { describe, it, expect } from 'vitest';
import { coincideBusquedaCliente } from '../crm-filtros';
import type { CommercialClient } from '@/types/commercial';

const cliente = {
    name: 'Tienda Andina',
    email: 'ventas@andina.co',
    additional_emails: ['compras@andina.co'],
    phone: '+57 317 6266322',
    additional_phones: ['0959837166'],
} as CommercialClient;

describe('coincideBusquedaCliente', () => {
    it('devuelve todo cuando la consulta está vacía', () => {
        expect(coincideBusquedaCliente(cliente, '')).toBe(true);
        expect(coincideBusquedaCliente(cliente, '   ')).toBe(true);
    });

    it('busca por nombre y correo sin importar mayúsculas', () => {
        expect(coincideBusquedaCliente(cliente, 'andina')).toBe(true);
        expect(coincideBusquedaCliente(cliente, 'VENTAS@')).toBe(true);
        expect(coincideBusquedaCliente(cliente, 'compras')).toBe(true);
        expect(coincideBusquedaCliente(cliente, 'ferretería')).toBe(false);
    });

    // El motivo de la función: el mismo número escrito de varias formas.
    it('encuentra el teléfono en cualquier formato', () => {
        expect(coincideBusquedaCliente(cliente, '+57 317 6266322')).toBe(true);
        expect(coincideBusquedaCliente(cliente, '3176266322')).toBe(true);
        expect(coincideBusquedaCliente(cliente, '6266322')).toBe(true);
        expect(coincideBusquedaCliente(cliente, '317-626-6322')).toBe(true);
    });

    it('también busca en los teléfonos adicionales', () => {
        expect(coincideBusquedaCliente(cliente, '9837166')).toBe(true);
    });

    it('no trata como teléfono una consulta de menos de 3 dígitos', () => {
        // "31" está dentro del teléfono, pero devolvería casi la cartera entera.
        expect(coincideBusquedaCliente(cliente, '31')).toBe(false);
    });

    it('no falla con fichas sin teléfono ni correos adicionales', () => {
        const minimo = { name: 'Sin datos' } as CommercialClient;
        expect(coincideBusquedaCliente(minimo, '3176266322')).toBe(false);
        expect(coincideBusquedaCliente(minimo, 'sin')).toBe(true);
    });
});
