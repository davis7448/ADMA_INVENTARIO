// Autentica el SDK de cliente cuando corre en el servidor.
//
// El problema que resuelve: server actions, rutas de API y los crons del VPS comparten
// la capa de datos con el navegador (src/lib/platform-sales.ts, src/lib/api.ts…), que usa
// el SDK de cliente. En el servidor no hay sesión, así que esas escrituras solo funcionan
// porque la regla `isAdminAccess()` concede acceso a las peticiones SIN autenticar — el
// mismo agujero que deja toda la base legible desde internet.
//
// Con este helper el servidor pasa a estar autenticado como una cuenta propia, y entonces
// `isAdminAccess()` puede cerrarse sin romper nada.
//
// No hace nada en el navegador: ahí ya hay sesión del usuario.
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { app } from '@/lib/firebase';

// Los crons del VPS no cargan .env.local (no usan dotenv), así que sin esto el helper no
// encontraba las credenciales, seguía sin autenticar y Firestore respondía
// permission-denied en cuanto se cerró la regla. Se carga aquí una sola vez, en servidor,
// para que ningún script tenga que acordarse. En Next las variables ya vienen del entorno,
// y dotenv no pisa las existentes.
if (typeof window === 'undefined') {
    try {
        // require dinámico: dotenv no debe entrar en el bundle del navegador
        (eval('require') as NodeRequire)('dotenv').config({ path: '.env.local' });
    } catch { /* en producción las variables vienen del entorno de App Hosting */ }
}

let enCurso: Promise<void> | null = null;

export async function ensureServerAuth(): Promise<void> {
    if (typeof window !== 'undefined') return; // navegador: la sesión es del usuario

    const auth = getAuth(app);
    if (auth.currentUser) return;

    const email = process.env.FIREBASE_SERVER_EMAIL;
    const password = process.env.FIREBASE_SERVER_PASSWORD;
    if (!email || !password) {
        // Sin credenciales no se puede autenticar. Se avisa una vez y se sigue: mientras
        // `isAdminAccess()` esté abierto, el acceso anónimo aún funciona.
        console.warn('[firebase-server-auth] Falta FIREBASE_SERVER_EMAIL/PASSWORD; el servidor consultará sin autenticar.');
        return;
    }

    // Una sola sesión por proceso: las peticiones concurrentes esperan a la misma.
    if (!enCurso) {
        enCurso = signInWithEmailAndPassword(auth, email, password)
            .then(() => { console.log('[firebase-server-auth] servidor autenticado'); })
            .catch(e => {
                console.error('[firebase-server-auth] no se pudo autenticar:', e?.code || e);
                enCurso = null; // permite reintentar en la siguiente petición
            });
    }
    await enCurso;
}
