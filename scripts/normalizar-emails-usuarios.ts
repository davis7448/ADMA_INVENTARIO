// Pasa a minúsculas el campo `email` de la colección `users`.
//
// Firebase Auth entrega siempre el correo en minúsculas. Un documento guardado como
// "Carol.Perea@ADMA.COM.CO" nunca empataba en findUserByEmail, así que la app le creaba
// un perfil nuevo en cada inicio de sesión: ese fue el segundo origen de los duplicados
// que consolidó scripts/fusionar-usuarios-duplicados.ts.
//
// Uso:
//   npx tsx scripts/normalizar-emails-usuarios.ts             → dry-run (por defecto)
//   npx tsx scripts/normalizar-emails-usuarios.ts --aplicar   → ejecuta
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APLICAR = process.argv.includes('--aplicar');

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

(async () => {
    console.log(APLICAR ? '=== APLICANDO ===' : '=== DRY-RUN (usa --aplicar para ejecutar) ===');
    const snap = await fs.collection('users').get();
    let n = 0;
    for (const d of snap.docs) {
        const email: string = (d.data() as any).email || '';
        const limpio = email.toLowerCase().trim();
        if (email === limpio) continue;
        n++;
        console.log(`  ${d.id}: ${email} -> ${limpio}`);
        if (APLICAR) await d.ref.update({ email: limpio });
    }
    console.log(`\n${n} documento(s) ${APLICAR ? 'normalizados' : 'por normalizar'} de ${snap.size}.`);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
