// Rellena dispatchOrders.exceptionTrackingNumbers en las órdenes ya existentes.
//
// Firestore no sabe consultar dentro de `exceptions` / `cancelledExceptions`, que son
// arrays de OBJETOS. Sin este campo plano, buscar una guía en excepción obligaba a leer
// las ~30.000 órdenes de la colección en cada pistoleo: el server action se quedaba sin
// memoria y devolvía 503. Ver searchDispatchGuides en src/lib/api.ts.
//
// A partir del despliegue, el campo lo mantienen processDispatch,
// cancelPendingDispatchItems y annulDispatchedGuideItems. Este script es solo para el
// histórico; es idempotente, así que se puede volver a correr sin riesgo.
//
// Uso:
//   npx tsx scripts/backfill-guias-excepcion.ts --dry-run   → solo informa
//   npx tsx scripts/backfill-guias-excepcion.ts             → aplica
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry-run');

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

const mismasGuias = (a: string[], b: string[]) =>
    a.length === b.length && a.every((g, i) => g === b[i]);

async function main() {
    const snap = await fs.collection('dispatchOrders').get();
    console.log(`Órdenes leídas: ${snap.size}`);

    let porEscribir = 0;
    let sinCambios = 0;
    let lote = fs.batch();
    let enLote = 0;

    for (const docSnap of snap.docs) {
        const orden = docSnap.data() as any;
        const guias = [...new Set(
            [...(orden.exceptions || []), ...(orden.cancelledExceptions || [])]
                .map((ex: any) => ex?.trackingNumber)
                .filter(Boolean)
        )] as string[];

        const actuales: string[] = orden.exceptionTrackingNumbers;
        // Una orden sin excepciones no necesita el campo: array-contains-any tampoco
        // cruza contra un array vacío. Se evitan así 30.000 escrituras inútiles.
        if (guias.length === 0 && actuales === undefined) {
            sinCambios++;
            continue;
        }
        if (Array.isArray(actuales) && mismasGuias(actuales, guias)) {
            sinCambios++;
            continue;
        }

        porEscribir++;
        if (DRY) continue;

        lote.update(docSnap.ref, { exceptionTrackingNumbers: guias });
        enLote++;
        if (enLote === 400) { // el límite de un batch son 500 operaciones
            await lote.commit();
            lote = fs.batch();
            enLote = 0;
        }
    }

    if (!DRY && enLote > 0) await lote.commit();

    console.log(`${DRY ? '[dry-run] ' : ''}Actualizadas: ${porEscribir} | ya correctas: ${sinCambios}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
