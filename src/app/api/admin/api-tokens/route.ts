// Alta, listado y revocación de tokens de API.
//
// Antes: el control de acceso era la cabecera `X-Admin-Key` o, directamente,
// `NODE_ENV === 'development'` — o sea, abierta de par en par en desarrollo. Y escribía
// con el SDK de cliente, que las reglas deniegan porque `api_tokens` no tiene bloque
// `match`, así que crear un token fallaba en silencio y la colección quedó vacía.
//
// Ahora: se identifica al administrador de verdad (sesión del navegador o idToken de
// Identity Toolkit, ver src/lib/admin-auth.ts) y se escribe con el Admin SDK.
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import { exigirAdmin } from '@/lib/admin-auth';
import { generarToken, COLECCION_TOKENS, COLECCION_CUPOS } from '@/lib/api-tokens-admin';

export const dynamic = 'force-dynamic';

const fallo = (error: string, status: number) =>
    NextResponse.json({ success: false, error }, { status });

async function db() {
    return getFirestore(await getApp());
}

// GET — listar
export async function GET(request: NextRequest) {
    const auth = await exigirAdmin(request);
    if (!auth.ok) return fallo(auth.error, auth.status);

    try {
        const snap = await (await db()).collection(COLECCION_TOKENS).orderBy('createdAt', 'desc').get();
        const tokens = snap.docs.map(d => {
            const t = d.data();
            return {
                ...t,
                token: d.id,
                createdAt: t.createdAt?.toDate?.().toISOString() ?? null,
                lastUsedAt: t.lastUsedAt?.toDate?.().toISOString() ?? null,
            };
        });
        return NextResponse.json({ success: true, tokens });
    } catch (error) {
        console.error('Error listando tokens:', error);
        return fallo('No se pudieron listar los tokens', 500);
    }
}

// POST — crear
export async function POST(request: NextRequest) {
    const auth = await exigirAdmin(request);
    if (!auth.ok) return fallo(auth.error, auth.status);

    try {
        const body = await request.json().catch(() => ({}));
        const clientName = String(body.clientName ?? '').trim();
        const clientId = String(body.clientId ?? '').trim();

        if (!clientName || !clientId) {
            return fallo('clientName y clientId son obligatorios', 400);
        }

        const limite = Number(body.rateLimitPerMinute);
        const origenes = Array.isArray(body.allowedOrigins)
            ? body.allowedOrigins.map((o: unknown) => String(o).trim()).filter(Boolean)
            : [];

        const token = generarToken();
        await (await db()).collection(COLECCION_TOKENS).doc(token).set({
            token,
            clientName,
            clientId,
            createdBy: auth.actor.email,
            createdByName: auth.actor.nombre,
            createdAt: FieldValue.serverTimestamp(),
            isActive: true,
            rateLimitPerMinute: Number.isFinite(limite) && limite > 0 ? Math.floor(limite) : 60,
            allowedOrigins: origenes,
            lastUsedAt: null,
            totalRequests: 0,
        });

        // El valor completo se devuelve UNA vez, al crearlo.
        return NextResponse.json({ success: true, token, message: 'Token creado' });
    } catch (error) {
        console.error('Error creando token:', error);
        return fallo('No se pudo crear el token', 500);
    }
}

// DELETE — revocar
export async function DELETE(request: NextRequest) {
    const auth = await exigirAdmin(request);
    if (!auth.ok) return fallo(auth.error, auth.status);

    try {
        const token = request.nextUrl.searchParams.get('token');
        if (!token) return fallo('Indica el token a revocar', 400);

        const ref = (await db()).collection(COLECCION_TOKENS).doc(token);
        if (!(await ref.get()).exists) return fallo('Ese token no existe', 404);

        // Se marca inactivo en vez de borrarlo: así queda el rastro de quién lo emitió y
        // cuánto se usó. El contador de cupo sí se limpia, que no sirve de nada.
        await ref.update({
            isActive: false,
            revokedAt: FieldValue.serverTimestamp(),
            revokedBy: auth.actor.email,
        });
        await (await db()).collection(COLECCION_CUPOS).doc(token).delete().catch(() => {});

        return NextResponse.json({ success: true, message: 'Token revocado' });
    } catch (error) {
        console.error('Error revocando token:', error);
        return fallo('No se pudo revocar el token', 500);
    }
}
