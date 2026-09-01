// Identifica al administrador que llama a una ruta de API.
//
// Admite dos formas de credencial, porque hay dos consumidores distintos:
//
//   1. La cookie `__session` — lo que usa la app. El admin ya está dentro, no escribe
//      ninguna contraseña y no hay nada que guardar en el cliente.
//   2. `Authorization: Bearer <idToken>` — para scripts. Quien llama hace login contra
//      Identity Toolkit y manda el idToken que recibe, así que la contraseña va a Google
//      y nunca atraviesa este servidor ni acaba en sus logs.
//
// El middleware NO pasa por /api/, así que aquí no vale mirar cabeceras como
// x-user-role: las pone quien llama. Hay que verificar la credencial de verdad.
import type { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';

export type Actor = { uid: string; email: string; nombre: string; rol: string };

export type Autorizacion =
    | { ok: true; actor: Actor }
    | { ok: false; status: 401 | 403; error: string };

const ROL_REQUERIDO = 'admin';

export async function exigirAdmin(request: NextRequest): Promise<Autorizacion> {
    const app = await getApp();
    const auth = getAuth(app);

    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    const cookie = request.cookies.get('__session')?.value;

    if (!bearer && !cookie) {
        return { ok: false, status: 401, error: 'Inicia sesión o manda un idToken en Authorization: Bearer' };
    }

    let email: string | undefined;
    let uid: string | undefined;
    try {
        // `true` en ambos casos: comprueba también que la sesión no haya sido revocada.
        const claims = bearer
            ? await auth.verifyIdToken(bearer, true)
            : await auth.verifySessionCookie(cookie!, true);
        email = claims.email;
        uid = claims.uid;
    } catch {
        return { ok: false, status: 401, error: 'Credencial inválida o caducada' };
    }

    if (!email || !uid) return { ok: false, status: 401, error: 'La credencial no identifica a ningún usuario' };

    // El rol vive en `users`, no en los claims del token. Hay correos con documento
    // duplicado (ver docs), así que se miran todas las fichas del correo y basta con que
    // una diga admin — es el mismo criterio con el que la app le da acceso hoy.
    const db = getFirestore(app);
    const fichas = await db.collection('users').where('email', '==', email).get();
    const admin = fichas.docs.find(d => d.data()?.role === ROL_REQUERIDO);

    if (!admin) {
        return { ok: false, status: 403, error: 'Se necesita rol de administrador' };
    }

    return {
        ok: true,
        actor: { uid, email, nombre: admin.data()?.name ?? email, rol: ROL_REQUERIDO },
    };
}
