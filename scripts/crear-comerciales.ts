// Crea los usuarios de los comerciales nuevos (Auth + documento en `users`).
// Replica lo que hace createUserAction (src/app/actions/users.ts) con dos ajustes:
//  · El documento se crea con ID = UID de Auth (setDoc) en vez de addDoc. Así se evita
//    que fixUserProfile (src/lib/commercial-api.ts:436) duplique el perfil la primera
//    vez que el comercial entra a su dashboard.
//  · Verifica que el commercialCode no choque con los existentes.
// Uso: npx tsx scripts/crear-comerciales.ts [--dry-run]
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

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

// El código es de 4 caracteres (lo exige CreateUserFormSchema) y sigue la convención
// que ya usan los comerciales actuales: inicial del nombre + 3 dígitos (C009, J001…).
const COMERCIALES = [
    { email: 'Oriana.Hernandez@ADMA.COM.CO', name: 'Oriana Hernández', code: 'O001' },
    { email: 'Carol.Perea@ADMA.COM.CO', name: 'Carol Perea', code: 'C010' },
    { email: 'Hermes.Mina@ADMA.COM.CO', name: 'Hermes Mina', code: 'H001' },
    { email: 'Pablo.Cesar@ADMA.COM.CO', name: 'Pablo César', code: 'P001' },
    { email: 'Marcela.Lopez@ADMA.COM.CO', name: 'Marcela López', code: 'M002' },
];

const clave = () => 'Adma' + crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + '#26';

async function main() {
    // Códigos ya usados, para no repetir
    const snap = await fs.collection('users').get();
    const usados = new Set(snap.docs.map(d => (d.data() as any).commercialCode).filter(Boolean));
    const choques = COMERCIALES.filter(c => usados.has(c.code));
    if (choques.length) {
        console.error('❌ Códigos ya en uso:', choques.map(c => c.code).join(', '));
        process.exit(1);
    }

    console.log(DRY ? '— SIMULACIÓN (no se crea nada) —\n' : '');
    for (const c of COMERCIALES) {
        const password = clave();
        const emailLower = c.email.toLowerCase();
        if (DRY) { console.log(`  ${c.email} · ${c.name} · código ${c.code}`); continue; }

        // 1) Usuario en Firebase Auth (si ya existe, se reutiliza y se actualiza la clave)
        let uid: string;
        try {
            const ex = await auth.getUserByEmail(c.email);
            uid = ex.uid;
            await auth.updateUser(uid, { password, displayName: c.name, disabled: false });
            console.log(`↻ ya existía en Auth: ${c.email}`);
        } catch {
            const creado = await auth.createUser({ email: c.email, password, displayName: c.name, emailVerified: true });
            uid = creado.uid;
            console.log(`✔ creado: ${c.email}`);
        }

        // 2) Documento en `users` con ID = UID (evita duplicados por fixUserProfile).
        //    Si ya hubiera un doc con ese correo y otro id, se avisa para revisarlo.
        const previos = await fs.collection('users').where('email', '==', c.email).get();
        for (const d of previos.docs) {
            if (d.id !== uid) console.log(`   ⚠ existe otro documento (${d.id}) con el mismo correo`);
        }
        await fs.collection('users').doc(uid).set({
            name: c.name,
            email: c.email,
            role: 'commercial',
            commercialCode: c.code,
            avatarUrl: `https://i.pravatar.cc/150?u=${emailLower}`,
        }, { merge: true });

        console.log(`   rol: commercial · código: ${c.code} · CLAVE: ${password}`);
    }
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
