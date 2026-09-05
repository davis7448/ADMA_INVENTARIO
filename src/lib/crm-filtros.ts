// Búsqueda de contactos en el CRM.
//
// Estaba copiada en tres pantallas (tablero, selector de destinatarios de Difusión y la
// tabla de producto por cliente) y en las tres miraba solo nombre y correo, así que un
// comercial que tenía el teléfono del cliente no podía encontrar su ficha. Aquí queda una
// sola versión que además busca por teléfono y por los correos adicionales.

import type { CommercialClient } from '@/types/commercial';
import { soloDigitos } from './telefono';

// Por debajo de 3 dígitos la búsqueda numérica devolvería casi la cartera entera, así que
// un "1" suelto se trata como texto y no como teléfono.
const MINIMO_DIGITOS_TELEFONO = 3;

export function coincideBusquedaCliente(cliente: CommercialClient, consulta: string): boolean {
    const q = consulta.trim().toLowerCase();
    if (!q) return true;

    if (cliente.name?.toLowerCase().includes(q)) return true;
    if (cliente.email?.toLowerCase().includes(q)) return true;
    if (cliente.additional_emails?.some(e => e?.toLowerCase().includes(q))) return true;

    // Se compara por subcadena de dígitos para que "+57 317 6266322", "3176266322" y
    // "6266322" encuentren la misma ficha. phone_key no sirve aquí: es el número
    // recortado a los últimos 9 dígitos y solo permite igualdad exacta.
    const digitos = soloDigitos(q);
    if (digitos.length >= MINIMO_DIGITOS_TELEFONO) {
        if (soloDigitos(cliente.phone).includes(digitos)) return true;
        if (cliente.additional_phones?.some(t => soloDigitos(t).includes(digitos))) return true;
    }

    return false;
}
