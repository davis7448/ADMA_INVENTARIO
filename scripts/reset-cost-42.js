#!/usr/bin/env node
/**
 * One-time migration: set cost = 0 on products/variants where cost === 42
 * (42 is the internal Excel error code for #N/A, incorrectly loaded as a cost value)
 * Run: node scripts/reset-cost-42.js [--dry-run]
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

  const snapshot = await db.collection('products').get();
  console.log(`Scanning ${snapshot.size} products...`);

  let productUpdates = 0;
  let variantUpdates = 0;
  const batchSize = 500;
  let batch = db.batch();
  let batchCount = 0;

  const commitBatch = async () => {
    if (!DRY_RUN && batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates = {};

    // Check root-level cost
    if (data.cost === 42) {
      console.log(`  [product] ${doc.id} "${data.name}" — cost 42 → 0`);
      updates.cost = 0;
      productUpdates++;
    }

    // Check variant costs
    if (Array.isArray(data.variants)) {
      const newVariants = data.variants.map(v => {
        if (v.cost === 42) {
          console.log(`  [variant] ${doc.id} "${data.name}" / variant "${v.name}" (${v.sku}) — cost 42 → 0`);
          variantUpdates++;
          return { ...v, cost: 0 };
        }
        return v;
      });

      const changed = newVariants.some((v, i) => v.cost !== data.variants[i].cost);
      if (changed) updates.variants = newVariants;
    }

    if (Object.keys(updates).length > 0 && !DRY_RUN) {
      batch.update(doc.ref, updates);
      batchCount++;
      if (batchCount >= batchSize) await commitBatch();
    }
  }

  await commitBatch();

  console.log(`\nDone.`);
  console.log(`  Products with cost reset: ${productUpdates}`);
  console.log(`  Variants with cost reset: ${variantUpdates}`);
  console.log(`  Total affected: ${productUpdates + variantUpdates}`);
}

migrate().catch(err => { console.error(err); process.exit(1); });
