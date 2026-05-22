#!/usr/bin/env node
/**
 * One-time migration: mark all 'Entrada' movements by elianaperdomo8 as 'Devolución de Cliente'.
 * Run: node scripts/migrate-devoluciones-eliana.js [--dry-run]
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be written' : '🚀 LIVE RUN — writing to Firestore');

  // Query all Entrada movements by this user
  const snapshot = await db.collection('inventoryMovements')
    .where('userId', '==', 'DqtCk4xacWOuPPrGu62N')
    .where('type', '==', 'Entrada')
    .get();

  console.log(`Found ${snapshot.size} Entrada movements by elianaperdomo8`);

  if (snapshot.size === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  let updated = 0;
  let skipped = 0;
  const batchSize = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const notes = data.notes || '';

    // Skip if already marked as devolución
    if (notes.toLowerCase().includes('devolución') || notes.toLowerCase().includes('devolucion')) {
      skipped++;
      continue;
    }

    // Replace leading 'reception' with 'Devolución de Cliente', keep the rest
    const newNotes = notes.startsWith('reception')
      ? notes.replace(/^reception/, 'Devolución de Cliente')
      : `Devolución de Cliente - ${notes}`.trim().replace(/ - $/, '');

    console.log(`  [${doc.id}] "${notes}" → "${newNotes}"`);

    if (!DRY_RUN) {
      batch.update(doc.ref, { notes: newNotes });
      batchCount++;
      if (batchCount % batchSize === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`  Committed batch of ${batchSize}`);
      }
    }
    updated++;
  }

  if (!DRY_RUN && batchCount % batchSize !== 0) {
    await batch.commit();
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already devolucion): ${skipped}`);
}

migrate().catch(err => { console.error(err); process.exit(1); });
