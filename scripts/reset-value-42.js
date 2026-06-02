#!/usr/bin/env node
/**
 * Migration: set to 0 any price/cost field equal to 42 on products and variants.
 * 42 is the internal Excel error code for #N/A, incorrectly loaded as a real value.
 *
 * Fields checked: cost, priceDropshipping, priceWholesale, priceMinSale, priceOptimalSale
 *
 * Run:
 *   node scripts/reset-value-42.js --dry-run   ← preview only
 *   node scripts/reset-value-42.js             ← apply changes
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

const FIELDS = ['cost', 'priceDropshipping', 'priceWholesale', 'priceMinSale', 'priceOptimalSale'];

async function migrate() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be written' : '🚀 LIVE RUN — writing to Firestore');
  console.log(`Fields checked: ${FIELDS.join(', ')}\n`);

  const snapshot = await db.collection('products').get();
  console.log(`Scanning ${snapshot.size} products...\n`);

  const counters = Object.fromEntries(FIELDS.map(f => [f, 0]));
  let variantCounters = Object.fromEntries(FIELDS.map(f => [f, 0]));
  let docsAffected = 0;

  const batchSize = 400;
  let batch = db.batch();
  let batchCount = 0;

  const flushBatch = async () => {
    if (!DRY_RUN && batchCount > 0) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates = {};

    // --- Root-level fields ---
    for (const field of FIELDS) {
      if (data[field] === 42) {
        console.log(`  [product] ${doc.id} "${data.name}" — ${field}: 42 → 0`);
        updates[field] = 0;
        counters[field]++;
      }
    }

    // --- Variant fields ---
    if (Array.isArray(data.variants)) {
      let variantsDirty = false;
      const newVariants = data.variants.map(v => {
        const variantUpdates = {};
        for (const field of FIELDS) {
          if (v[field] === 42) {
            console.log(`  [variant] ${doc.id} "${data.name}" / "${v.name}" (${v.sku}) — ${field}: 42 → 0`);
            variantUpdates[field] = 0;
            variantCounters[field]++;
            variantsDirty = true;
          }
        }
        return Object.keys(variantUpdates).length > 0 ? { ...v, ...variantUpdates } : v;
      });

      if (variantsDirty) updates.variants = newVariants;
    }

    if (Object.keys(updates).length > 0) {
      docsAffected++;
      if (!DRY_RUN) {
        batch.update(doc.ref, updates);
        batchCount++;
        if (batchCount >= batchSize) await flushBatch();
      }
    }
  }

  await flushBatch();

  console.log('\n--- Summary ---');
  console.log(`Documents affected: ${docsAffected}`);
  console.log('\nProduct-level resets:');
  for (const f of FIELDS) {
    if (counters[f] > 0) console.log(`  ${f}: ${counters[f]}`);
  }
  console.log('\nVariant-level resets:');
  for (const f of FIELDS) {
    if (variantCounters[f] > 0) console.log(`  ${f}: ${variantCounters[f]}`);
  }

  const total = FIELDS.reduce((s, f) => s + counters[f] + variantCounters[f], 0);
  console.log(`\nTotal fields reset: ${total}`);
  if (DRY_RUN) console.log('\n⚠️  DRY RUN — run without --dry-run to apply changes.');
}

migrate().catch(err => { console.error(err); process.exit(1); });
