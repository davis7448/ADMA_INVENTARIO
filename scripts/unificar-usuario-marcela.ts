// Unifica los dos usuarios de Marcela en uno solo.
//
// EL PROBLEMA
// Marcela tiene dos cuentas con CORREOS DISTINTOS, así que fusionar-usuarios-duplicados.ts
// nunca las vio: ese script agrupa por correo.
//
//   pCTAAZVnBO8lxrCA3lpV   marcela@adma.com.co        último login 28/8/2026
//                          → 65 clientes, 32 altas, 30 eventos, 86 modificaciones,
//                            9 promociones, 1 perfil de gamificación
//   3aT3TuPUcCRKSnzZGEi9GjNO9IV2  marcela.lopez@adma.com.co   creada el 6/8/2026 y nunca
//                          → CERO referencias en todo Firestore              usada de nuevo
//
// REGLA: gana el documento que tiene la historia (pCTAAZ…), no el que tiene el id "bien
// formado". Migrar al revés obligaría a reescribir 223 referencias y a cambiarle el correo
// de login sin ninguna ganancia. El documento vacío solo aporta el commercialCode.
//
// La cuenta de Auth sobrante se DESHABILITA, no se borra: es reversible y no rompe nada
// que la referencie.
//
// Uso:
//   npx tsx scripts/unificar-usuario-marcela.ts             → dry-run (por defecto)
//   npx tsx scripts/unificar-usuario-marcela.ts --aplicar   → ejecuta
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { writeFileSync, mkdirSync } from 'node:fs';

const APLICAR = process.argv.includes('--aplicar');

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();
const auth = getAuth();

const SOBREVIVE = 'pCTAAZVnBO8lxrCA3lpV';               // marcela@adma.com.co
const ABSORBIDO = '3aT3TuPUcCRKSnzZGEi9GjNO9IV2';       // marcela.lopez@adma.com.co (= su UID de Auth)
const NOMBRE_FINAL = 'Marcela López';
const CODIGO_FINAL = 'M002';

// Mismas colecciones que REFERENCIAS/REFERENCIAS_ARRAY de fusionar-usuarios-duplicados.ts.
// Si alguna devuelve algo, el documento "vacío" dejó de estarlo y la fusión ya no es
// trivial: hay que repuntar referencias y esto no lo hace.
const REFERENCIAS: { col: string; campo: string }[] = [
    { col: 'inventoryMovements', campo: 'userId' },
    { col: 'return_guides', campo: 'registeredBy' },
    { col: 'dispatchOrders', campo: 'createdBy.id' },
    { col: 'products', campo: 'createdBy.id' },
    { col: 'clients', campo: 'assigned_commercial_id' },
    { col: 'clients', campo: 'created_by' },
    { col: 'client_events', campo: 'created_by' },
    { col: 'client_tests', campo: 'created_by' },
    { col: 'cancellationRequests', campo: 'requestedBy.id' },
    { col: 'modificaciones', campo: 'solicitadoPor.id' },
    { col: 'importRequests', campo: 'requestedBy.id' },
    { col: 'externalStockSnapshots', campo: 'uploadedBy.id' },
    { col: 'productPromotions', campo: 'commercialId' },
    { col: 'task_notifications', campo: 'userId' },
    { col: 'task_rejection_tracker', campo: 'userId' },
    { col: 'user_gamification_profiles', campo: 'userId' },
    { col: 'user_missions', campo: 'userId' },
    { col: 'tasks', campo: 'createdBy' },
    { col: 'tasks', campo: 'assignedTo' },
    { col: 'tasks', campo: 'originalAssignee' },
];

// Ids dentro de arrays: no son consultables con where(), hay que mirar los documentos.
const REFERENCIAS_ARRAY: { col: string; campo: string; subcampo: string }[] = [
    { col: 'clients', campo: 'notes', subcampo: 'created_by' },
    { col: 'tasks', campo: 'history', subcampo: 'userId' },
];

async function contarReferencias(id: string): Promise<{ detalle: string[]; total: number }> {
    const detalle: string[] = [];
    let total = 0;

    for (const { col, campo } of REFERENCIAS) {
        const n = (await fs.collection(col).where(campo, '==', id).count().get()).data().count;
        if (n) { detalle.push(`${col}.${campo} = ${n}`); total += n; }
    }

    for (const { col, campo, subcampo } of REFERENCIAS_ARRAY) {
        const snap = await fs.collection(col).get();
        const n = snap.docs.filter(d => {
            const arr = d.get(campo);
            return Array.isArray(arr) && arr.some((x: any) => x?.[subcampo] === id);
        }).length;
        if (n) { detalle.push(`${col}.${campo}[].${subcampo} = ${n}`); total += n; }
    }

    return { detalle, total };
}

async function main() {
    console.log(`\n${APLICAR ? '' : '— SIMULACIÓN (no se escribe nada) —\n'}Unificación de los usuarios de Marcela\n`);

    const [docSobrevive, docAbsorbido] = await Promise.all([
        fs.collection('users').doc(SOBREVIVE).get(),
        fs.collection('users').doc(ABSORBIDO).get(),
    ]);

    if (!docSobrevive.exists) throw new Error(`El documento que debe sobrevivir (${SOBREVIVE}) no existe.`);
    if (!docAbsorbido.exists) {
        console.log(`El documento ${ABSORBIDO} ya no existe: la unificación ya se hizo. Nada que hacer.`);
        return;
    }

    console.log(`  sobrevive  ${SOBREVIVE}  ${JSON.stringify(docSobrevive.data())}`);
    console.log(`  se absorbe ${ABSORBIDO}  ${JSON.stringify(docAbsorbido.data())}\n`);

    // Guardia: el absorbido tiene que seguir vacío.
    console.log('Comprobando que el documento a absorber no tenga referencias...');
    const { detalle, total } = await contarReferencias(ABSORBIDO);
    if (total > 0) {
        console.error(`\n❌ ${ABSORBIDO} ya tiene ${total} referencias:`);
        detalle.forEach(d => console.error(`     ${d}`));
        throw new Error('Dejó de estar vacío: hay que repuntar esas referencias antes de borrarlo. Este script no lo hace.');
    }
    console.log('  sin referencias ✔\n');

    if (!APLICAR) {
        console.log('Se haría:');
        console.log(`  1. users/${SOBREVIVE} ← name: "${NOMBRE_FINAL}", commercialCode: "${CODIGO_FINAL}"`);
        console.log(`  2. borrar users/${ABSORBIDO}`);
        console.log(`  3. deshabilitar en Auth el uid ${ABSORBIDO} (marcela.lopez@adma.com.co)`);
        console.log('\nDry-run: no se escribió nada.');
        return;
    }

    // Respaldo antes de tocar nada.
    mkdirSync('scripts/output', { recursive: true });
    const salida = `scripts/output/unificacion-marcela-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(salida, JSON.stringify({
        fecha: new Date().toISOString(),
        sobrevive: { id: SOBREVIVE, datos: docSobrevive.data() },
        absorbido: { id: ABSORBIDO, datos: docAbsorbido.data() },
    }, null, 2));
    console.log(`Respaldo: ${salida}\n`);

    await fs.collection('users').doc(SOBREVIVE).set(
        { name: NOMBRE_FINAL, commercialCode: CODIGO_FINAL },
        { merge: true },
    );
    console.log(`✔ users/${SOBREVIVE}: name="${NOMBRE_FINAL}", commercialCode="${CODIGO_FINAL}"`);

    await fs.collection('users').doc(ABSORBIDO).delete();
    console.log(`✔ borrado users/${ABSORBIDO}`);

    try {
        await auth.updateUser(ABSORBIDO, { disabled: true });
        console.log(`✔ deshabilitada la cuenta de Auth ${ABSORBIDO} (marcela.lopez@adma.com.co)`);
    } catch (e) {
        console.log(`⚠ no se pudo deshabilitar la cuenta de Auth: ${e instanceof Error ? e.message : e}`);
    }

    console.log('\nMarcela queda con un solo usuario. Entra con marcela@adma.com.co, igual que hasta hoy.');
}

main().then(() => process.exit(0)).catch(e => { console.error('\n' + (e instanceof Error ? e.message : e)); process.exit(1); });
