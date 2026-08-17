// Crea la cuenta con la que el SERVIDOR se autentica contra Firestore.
//
// Por qué existe: server actions, rutas de API y los crons del VPS usan el SDK de
// cliente. Al correr en el servidor no hay sesión, así que hoy funcionan solo porque
// `isAdminAccess()` concede acceso a las peticiones sin autenticar — el mismo agujero
// que deja la base abierta a internet.
//
// Con esta cuenta el servidor pasa a estar autenticado, y entonces se puede cerrar
// `isAdminAccess()` sin romper nada.
//
// Uso: npx tsx scripts/crear-cuenta-servicio.ts [--rotar]
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

const ROTAR = process.argv.includes('--rotar');
const EMAIL = 'sistema@adma.com.co';
const NOMBRE = 'Cuenta de servicio (servidor)';

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});

// Sin `#`: dotenv lo interpreta como inicio de comentario y trunca el valor en
// .env.local, lo que produce un `auth/invalid-credential` difícil de diagnosticar.
const clave = () => 'Svc' + crypto.randomBytes(18).toString('base64url') + '26';

async function main() {
    const auth = getAuth();
    const fs = getFirestore();
    const password = clave();

    let uid: string;
    try {
        const existente = await auth.getUserByEmail(EMAIL);
        uid = existente.uid;
        if (!ROTAR) {
            console.log(`La cuenta ${EMAIL} ya existe (uid ${uid}).`);
            console.log('Usa --rotar para generar una contraseña nueva.');
            return;
        }
        await auth.updateUser(uid, { password, displayName: NOMBRE, disabled: false });
        console.log('↻ contraseña rotada');
    } catch {
        const creado = await auth.createUser({ email: EMAIL, password, displayName: NOMBRE, emailVerified: true });
        uid = creado.uid;
        console.log('✔ cuenta creada');
    }

    // Documento indexado por UID, para que sirva cuando se restauren los roles reales.
    await fs.collection('users').doc(uid).set({
        name: NOMBRE,
        email: EMAIL,
        role: 'admin',
        esCuentaDeServicio: true,
    }, { merge: true });

    console.log(`\nuid: ${uid}`);
    console.log('\nAgrega esto a .env.local del VPS y como secreto en App Hosting:');
    console.log(`  FIREBASE_SERVER_EMAIL=${EMAIL}`);
    console.log(`  FIREBASE_SERVER_PASSWORD='${password}'   ← entre comillas`);
}

main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
