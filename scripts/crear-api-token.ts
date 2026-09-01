// Crea un token para las rutas de API públicas (/api/privatizaciones).
//
// Por qué existe: src/lib/api-tokens.ts escribe con el SDK de cliente, y `api_tokens` no
// tiene bloque `match` en firestore.rules, así que cae en el deny por defecto y la
// creación falla en silencio — por eso la colección estaba vacía. Este script escribe con
// el Admin SDK, que no pasa por las reglas.
//
// Uso:
//   npx tsx scripts/crear-api-token.ts "NOMBRE CLIENTE" cliente-id [limite/min] [origen,origen]
//   npx tsx scripts/crear-api-token.ts --listar
//   npx tsx scripts/crear-api-token.ts --revocar tk_adma_xxxxx
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const db = getFirestore();
const COLECCION = 'api_tokens';

// randomBytes en vez de Math.random(): un token es una credencial, y Math.random() no es
// criptográficamente seguro. 24 bytes en base64url ≈ 32 caracteres.
const generarToken = () => 'tk_adma_' + randomBytes(24).toString('base64url');

async function listar() {
    const snap = await db.collection(COLECCION).get();
    if (snap.empty) return console.log('No hay tokens.');
    for (const d of snap.docs) {
        const t = d.data();
        const estado = t.isActive ? 'activo' : 'revocado';
        console.log(`${t.clientName.padEnd(24)} ${estado.padEnd(9)} usos=${t.totalRequests ?? 0}  ${d.id.slice(0, 16)}…`);
    }
}

async function revocar(token: string) {
    const ref = db.collection(COLECCION).doc(token);
    if (!(await ref.get()).exists) throw new Error(`El token ${token} no existe.`);
    await ref.update({ isActive: false, revokedAt: FieldValue.serverTimestamp() });
    console.log('✅ Token revocado.');
}

async function crear(clientName: string, clientId: string, limite: number, origenes: string[]) {
    const token = generarToken();
    await db.collection(COLECCION).doc(token).set({
        token,
        clientName,
        clientId,
        createdBy: 'scripts/crear-api-token.ts',
        createdAt: FieldValue.serverTimestamp(),
        isActive: true,
        rateLimitPerMinute: limite,
        allowedOrigins: origenes,
        lastUsedAt: null,
        totalRequests: 0,
    });

    console.log(`✅ Token creado para ${clientName}`);
    console.log(`\n   ${token}\n`);
    console.log('   Guárdalo ahora: no se puede volver a mostrar sin leer Firestore.');
    console.log(`   Límite: ${limite}/min · Orígenes: ${origenes.length ? origenes.join(', ') : 'sin restricción'}`);
    console.log(`\n   curl -H "X-API-Token: ${token}" \\\n        "$BASE_URL/api/privatizaciones?correo=cliente@ejemplo.com"`);
}

async function main() {
    const [arg1, arg2, arg3, arg4] = process.argv.slice(2);

    if (arg1 === '--listar') return listar();
    if (arg1 === '--revocar') {
        if (!arg2) throw new Error('Indica el token a revocar.');
        return revocar(arg2);
    }
    if (!arg1 || !arg2) {
        throw new Error('Uso: npx tsx scripts/crear-api-token.ts "NOMBRE CLIENTE" cliente-id [limite/min] [origenes]');
    }

    const limite = Number(arg3) || 60;
    const origenes = arg4 ? arg4.split(',').map(o => o.trim()).filter(Boolean) : [];
    return crear(arg1, arg2, limite, origenes);
}

main().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1); });
