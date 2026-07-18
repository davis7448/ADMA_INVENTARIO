/**
 * Seed script para las ubicaciones de bodega (colección `locations`)
 *
 * Uso: npx tsx scripts/seed-locations.ts [--dry-run]
 *
 * Este script:
 * 1. Genera los códigos de ubicación {ESTANTERIA}-{FONDO}-{PISO}-{ESTIBA}
 *    según el mapa físico de la bodega (122 ubicaciones)
 * 2. Limpia el campo `locationId` de los productos que lo tengan
 * 3. Elimina TODOS los documentos actuales de `locations`
 * 4. Crea las nuevas ubicaciones con ID determinista = código
 *
 * --dry-run  Muestra conteos y códigos sin escribir nada en Firestore
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

const LOCATIONS_COLLECTION = 'locations';
const PRODUCTS_COLLECTION = 'products';
const BATCH_LIMIT = 500;

// Mapa físico de la bodega: fondos disponibles por estantería y piso.
// La estantería B es más corta: fondos 1-5 en pisos 1-2 y 1-3 en piso 3.
const PISOS = [1, 2, 3] as const;
const ESTIBAS = ['A', 'B'] as const;
const FONDOS_POR_ESTANTERIA: Record<string, (piso: number) => number> = {
  A: () => 7,
  B: (piso) => (piso === 3 ? 3 : 5),
  C: () => 9,
};

function generateLocationCodes(): string[] {
  const codes: string[] = [];
  for (const piso of PISOS) {
    for (const estanteria of Object.keys(FONDOS_POR_ESTANTERIA)) {
      const maxFondo = FONDOS_POR_ESTANTERIA[estanteria](piso);
      for (let fondo = 1; fondo <= maxFondo; fondo++) {
        for (const estiba of ESTIBAS) {
          codes.push(`${estanteria}-${fondo}-${piso}-${estiba}`);
        }
      }
    }
  }
  return codes;
}

function initFirebase() {
  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({
        projectId: 'studio-9748962172-82b35',
        clientEmail: 'firebase-adminsdk-fbsvc@studio-9748962172-82b35.iam.gserviceaccount.com',
        privateKey: privateKey,
      }),
    });
  }
}

async function clearProductLocationIds(db: FirebaseFirestore.Firestore): Promise<number> {
  const snapshot = await db.collection(PRODUCTS_COLLECTION).get();
  const withLocation = snapshot.docs.filter((doc) => doc.get('locationId') !== undefined);

  if (DRY_RUN) return withLocation.length;

  for (let i = 0; i < withLocation.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const doc of withLocation.slice(i, i + BATCH_LIMIT)) {
      batch.update(doc.ref, { locationId: FieldValue.delete() });
    }
    await batch.commit();
  }
  return withLocation.length;
}

async function deleteAllLocations(db: FirebaseFirestore.Firestore): Promise<number> {
  const snapshot = await db.collection(LOCATIONS_COLLECTION).get();

  if (DRY_RUN) return snapshot.size;

  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const doc of snapshot.docs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
  return snapshot.size;
}

async function createLocations(db: FirebaseFirestore.Firestore, codes: string[]): Promise<number> {
  if (DRY_RUN) return codes.length;

  for (let i = 0; i < codes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const code of codes.slice(i, i + BATCH_LIMIT)) {
      batch.set(db.collection(LOCATIONS_COLLECTION).doc(code), { name: code });
    }
    await batch.commit();
  }
  return codes.length;
}

async function main() {
  const codes = generateLocationCodes();
  console.log(`Ubicaciones a crear: ${codes.length}`);
  console.log(codes.join(', '));
  console.log('');

  if (DRY_RUN) {
    console.log('— DRY RUN: no se escribirá nada en Firestore —');
  }

  initFirebase();
  const db = getFirestore();

  const clearedProducts = await clearProductLocationIds(db);
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Productos con locationId limpiado: ${clearedProducts}`);

  const deleted = await deleteAllLocations(db);
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Ubicaciones anteriores eliminadas: ${deleted}`);

  const created = await createLocations(db, codes);
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Ubicaciones nuevas creadas: ${created}`);

  console.log('');
  console.log(DRY_RUN ? 'Dry run completado.' : '✅ Carga de ubicaciones completada.');
}

main().catch((error) => {
  console.error('❌ Error en el seed de ubicaciones:', error);
  process.exit(1);
});
