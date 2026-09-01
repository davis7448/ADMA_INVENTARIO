// Validación de tokens para las rutas de API públicas, con el Admin SDK.
//
// Por qué no se reusa src/lib/api-tokens.ts: ese módulo consulta con el SDK de cliente,
// que sí pasa por las reglas — y `api_tokens` no tiene bloque `match` en firestore.rules,
// así que cae en el deny por defecto. Comprobado el 1/9/2026: leer la colección como la
// cuenta del servidor devuelve 403 PERMISSION_DENIED, y por eso validateApiToken()
// siempre responde inválido (la colección, además, está vacía: nunca se creó un token).
// El Admin SDK no pasa por las reglas, así que esto funciona sin tocarlas ni exponer los
// tokens a ningún usuario del navegador.
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';

export const COLECCION_TOKENS = 'api_tokens';
export const COLECCION_CUPOS = 'api_rate_limits';

const VENTANA_MS = 60_000;

export type TokenApi = {
    token: string;
    clientName: string;
    clientId: string;
    isActive: boolean;
    rateLimitPerMinute: number;
    allowedOrigins: string[];
};

export type ResultadoValidacion =
    | { valido: true; token: TokenApi }
    | { valido: false; error: string };

export type Cupo = {
    permitido: boolean;
    restantes: number;
    reinicioEn: Date;
};

async function fs() {
    return getFirestore(await getApp());
}

/** Lee el token y comprueba que exista y esté activo. */
export async function validarToken(token: string): Promise<ResultadoValidacion> {
    // El id del documento ES el token; un token con barras o puntos rompería la ruta.
    if (!token || !/^[A-Za-z0-9_-]{8,128}$/.test(token)) {
        return { valido: false, error: 'Token con formato inválido' };
    }
    try {
        const snap = await (await fs()).collection(COLECCION_TOKENS).doc(token).get();
        if (!snap.exists) return { valido: false, error: 'Token inválido' };

        const datos = snap.data() as Partial<TokenApi>;
        if (!datos.isActive) return { valido: false, error: 'Token revocado' };

        return {
            valido: true,
            token: {
                token,
                clientName: datos.clientName ?? 'desconocido',
                clientId: datos.clientId ?? '',
                isActive: true,
                rateLimitPerMinute: Number(datos.rateLimitPerMinute) || 60,
                allowedOrigins: Array.isArray(datos.allowedOrigins) ? datos.allowedOrigins : [],
            },
        };
    } catch (error) {
        console.error('[api-tokens-admin] error validando token:', error);
        return { valido: false, error: 'No se pudo validar el token' };
    }
}

/**
 * ¿El origen del navegador está permitido para este token?
 * Sin origen (curl, servidor a servidor) o sin lista configurada, se permite.
 */
export function origenPermitido(token: TokenApi, origen: string | null): boolean {
    if (!origen || token.allowedOrigins.length === 0) return true;
    return token.allowedOrigins.some(permitido => origen === permitido || origen.includes(permitido));
}

/**
 * Cupo por minuto, en ventana fija y dentro de una transacción.
 *
 * La versión del SDK de cliente escribía `windowStart: serverTimestamp()` en CADA
 * petición, así que la ventana no vencía nunca y el contador solo subía. Aquí la ventana
 * se guarda como epoch ms y se reinicia cuando han pasado 60 s.
 */
export async function consumirCupo(token: string, limitePorMinuto: number): Promise<Cupo> {
    const ref = (await fs()).collection(COLECCION_CUPOS).doc(token);
    const ahora = Date.now();

    try {
        return await (await fs()).runTransaction(async trx => {
            const snap = await trx.get(ref);
            const datos = snap.exists ? snap.data() : undefined;

            const inicio = Number(datos?.windowStart) || 0;
            const dentroDeVentana = ahora - inicio < VENTANA_MS;
            const inicioVentana = dentroDeVentana ? inicio : ahora;
            const usados = dentroDeVentana ? Number(datos?.count) || 0 : 0;
            const reinicioEn = new Date(inicioVentana + VENTANA_MS);

            if (usados >= limitePorMinuto) {
                return { permitido: false, restantes: 0, reinicioEn };
            }

            trx.set(ref, {
                token,
                windowStart: inicioVentana,
                count: usados + 1,
                lastRequest: Timestamp.fromMillis(ahora),
            }, { merge: true });

            return { permitido: true, restantes: limitePorMinuto - usados - 1, reinicioEn };
        });
    } catch (error) {
        // Un fallo del contador no debe tumbar la API: se deja pasar y se registra.
        console.error('[api-tokens-admin] error en el cupo:', error);
        return { permitido: true, restantes: limitePorMinuto, reinicioEn: new Date(ahora + VENTANA_MS) };
    }
}

/** Estadística de uso. No bloquea la respuesta si falla. */
export async function registrarUso(token: string): Promise<void> {
    try {
        await (await fs()).collection(COLECCION_TOKENS).doc(token).update({
            lastUsedAt: FieldValue.serverTimestamp(),
            totalRequests: FieldValue.increment(1),
        });
    } catch (error) {
        console.error('[api-tokens-admin] no se pudo registrar el uso:', error);
    }
}
