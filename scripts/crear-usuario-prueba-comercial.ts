// Crea un usuario de prueba con rol `commercial` (rol puro, no director).
//
// Por qué hace falta: los usuarios de capacitación existentes son `commercial_director`
// y `logistics`. Sin un `commercial` real no se puede comprobar que el módulo de
// actividad le restrinja la vista a su propia gestión — que es justo lo que promete.
//
// Uso:
//   npx tsx scripts/crear-usuario-prueba-comercial.ts --dry-run
//   npx tsx scripts/crear-usuario-prueba-comercial.ts
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry-run');

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const auth = getAuth();
const fs = getFirestore();

const EMAIL = 'capacitacion.comercial2@adma.com.co';
const NOMBRE = 'Capacitación Comercial (rol comercial)';
const PASSWORD = 'AdmaPrueba#Com26';

async function main() {
    // El código de 4 dígitos es obligatorio para el rol commercial; se busca uno libre.
    const snap = await fs.collection('users').get();
    const usados = new Set(snap.docs.map(d => (d.data() as any).commercialCode).filter(Boolean));
    let codigo = '';
    for (let i = 900; i < 1000; i++) {
        const candidato = `T${i}`;
        if (!usados.has(candidato)) { codigo = candidato; break; }
    }
    if (!codigo) { console.error('No hay códigos libres'); process.exit(1); }

    console.log(`${EMAIL} · rol commercial · código ${codigo}`);
    if (DRY) { console.log('(dry-run: no se creó nada)'); return; }

    let uid: string;
    try {
        const ex = await auth.getUserByEmail(EMAIL);
        uid = ex.uid;
        await auth.updateUser(uid, { password: PASSWORD, displayName: NOMBRE, disabled: false });
        console.log('↻ ya existía en Auth, se actualizó la clave');
    } catch {
        const creado = await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: NOMBRE, emailVerified: true });
        uid = creado.uid;
        console.log('✔ creado en Auth');
    }

    await fs.collection('users').doc(uid).set({
        name: NOMBRE,
        email: EMAIL,
        role: 'commercial',
        commercialCode: codigo,
        avatarUrl: `https://i.pravatar.cc/150?u=${EMAIL}`,
    }, { merge: true });

    console.log(`✅ listo · usuario: ${EMAIL} · clave: ${PASSWORD} · id: ${uid}`);
}

main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
