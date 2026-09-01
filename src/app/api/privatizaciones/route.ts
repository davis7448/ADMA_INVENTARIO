// Consulta pública de privatizaciones: qué IDs de plataforma están privatizados a qué
// cliente, y el historial de modificaciones de cada uno.
//
// Sustituye a /api/modificaciones para este uso. Aquella ruta lee Firestore por REST sin
// credenciales y, desde que isAdminAccess() se cerró, devuelve 200 con lista vacía; su
// único control de acceso es la cabecera x-user-role, que pone quien llama porque el
// middleware no pasa por /api/. Aquí se autentica con token y se lee con el Admin SDK.
//
// Manual: docs/integraciones/api-privatizaciones.md
import { NextRequest, NextResponse } from 'next/server';
import { validarToken, origenPermitido, consumirCupo, registrarUso } from '@/lib/api-tokens-admin';
import { consultarPrivatizaciones } from '@/lib/privatizaciones';
import { corsHeaders, handleCors } from '@/lib/cors';

export const dynamic = 'force-dynamic';

// handleCors devuelve null cuando no es preflight; OPTIONS debe responder siempre algo,
// o Next rechaza el tipo de la ruta (es el error que hoy arrastra search-guides).
export async function OPTIONS(request: NextRequest) {
    return handleCors(request) ?? new NextResponse(null, { status: 204, headers: corsHeaders });
}

const error = (mensaje: string, status: number, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ success: false, error: mensaje, ...extra }, { status, headers: corsHeaders });

/** Acepta "2026-01-01" y fechas ISO completas. */
function aEpoch(valor: string | null, finDelDia = false): number | null | undefined {
    if (!valor) return undefined;
    const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(valor);
    const ms = new Date(soloFecha ? `${valor}T${finDelDia ? '23:59:59.999' : '00:00:00.000'}Z` : valor).getTime();
    return Number.isNaN(ms) ? null : ms;
}

export async function GET(request: NextRequest) {
    try {
        const corsResponse = handleCors(request);
        if (corsResponse) return corsResponse;

        const token = request.headers.get('X-API-Token');
        if (!token) return error('Falta la cabecera X-API-Token', 401);

        const validacion = await validarToken(token);
        if (!validacion.valido) return error(validacion.error, 401);

        if (!origenPermitido(validacion.token, request.headers.get('origin'))) {
            return error('Origen no permitido', 403);
        }

        const cupo = await consumirCupo(token, validacion.token.rateLimitPerMinute);
        if (!cupo.permitido) {
            return error('Límite de peticiones superado', 429, {
                retryAfter: Math.ceil((cupo.reinicioEn.getTime() - Date.now()) / 1000),
            });
        }

        const params = request.nextUrl.searchParams;
        const clientId = params.get('clientId')?.trim() || undefined;
        const correo = params.get('correo')?.trim() || undefined;
        const itemId = params.get('id')?.trim().replace(/\.0+$/, '') || undefined;
        const plataforma = params.get('plataforma')?.trim() || undefined;

        if (!clientId && !correo && !itemId) {
            return error('Indica al menos uno de: correo, clientId o id', 400);
        }

        const desde = aEpoch(params.get('desde'));
        const hasta = aEpoch(params.get('hasta'), true);
        if (desde === null || hasta === null) {
            return error('Fechas inválidas: usa YYYY-MM-DD o una fecha ISO', 400);
        }

        const resultado = await consultarPrivatizaciones({
            clientId,
            correo,
            itemId,
            plataforma,
            desde: desde ?? undefined,
            hasta: hasta ?? undefined,
            incluirHistorial: params.get('historial') !== '0',
        });

        // Se pidió por cliente y no hay ficha: se avisa, pero la consulta sigue valiendo
        // por correo (hay modificaciones a correos que el CRM no tiene registrados).
        if (clientId && !resultado.cliente) {
            return error(`No existe el cliente ${clientId}`, 404);
        }

        await registrarUso(token);

        return NextResponse.json({
            success: true,
            clientName: validacion.token.clientName,
            timestamp: new Date().toISOString(),
            consulta: { clientId: clientId ?? null, correo: correo ?? null, id: itemId ?? null, plataforma: plataforma ?? null },
            ...resultado,
            rateLimit: {
                remaining: cupo.restantes,
                resetTime: cupo.reinicioEn.toISOString(),
            },
        }, { headers: corsHeaders });

    } catch (e) {
        console.error('Error en /api/privatizaciones:', e);
        return error('Error interno', 500);
    }
}
