// Comparación de teléfonos entre formatos.
//
// Los comerciales escriben el mismo número de muchas maneras ("+57 317 6266322",
// "317 8180473", "3176266322", "849-652-6207"), y compararlos como texto exacto deja
// pasar duplicados reales. La clave se queda con los dígitos y toma los últimos 9,
// que es el tramo que sobrevive al prefijo de país y al 0 nacional:
//
//   Ecuador   +593 95 983 7166 → 959837166   ·  0959837166 → 959837166
//   Colombia  +57 317 6266322  → 176266322   ·  3176266322 → 176266322
//   Rep. Dom. +1 849-652-6207  → 496526207   ·  8496526207 → 496526207
//
// Los números con menos de 9 dígitos se usan completos: recortarlos daría una clave
// aún más corta y con más riesgo de chocar con otro cliente.
const LONGITUD_CLAVE = 9;

export function claveTelefono(valor?: string | null): string {
    if (!valor) return '';
    const digitos = String(valor).replace(/\D/g, '');
    if (!digitos) return '';
    return digitos.slice(-LONGITUD_CLAVE);
}

// Claves de una lista de teléfonos, sin vacíos ni repetidos.
// Se usa para el campo additional_phone_keys, que se consulta con array-contains.
export function clavesTelefono(valores?: (string | null | undefined)[] | null): string[] {
    if (!valores?.length) return [];
    const claves = new Set<string>();
    for (const v of valores) {
        const k = claveTelefono(v);
        if (k) claves.add(k);
    }
    return [...claves];
}
