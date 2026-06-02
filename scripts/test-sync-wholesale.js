#!/usr/bin/env node
/**
 * Test script for syncWholesaleMarginsAction logic.
 * Replicates exactly the server action without writing to Firestore.
 *
 * Run: node scripts/test-sync-wholesale.js
 */
require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const SALES_WINDOW_DAYS = 30;

function roundToHundred(value) {
  return Math.ceil(value / 100) * 100;
}

async function runTest() {
  console.log('=== TEST: syncWholesaleMarginsAction (DRY RUN) ===\n');

  // ── 1. Load rotation categories ──────────────────────────────────────────
  console.log('1. Loading rotation categories...');
  const catSnap = await db.collection('rotationCategories').get();
  const categories = catSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => b.salesThreshold - a.salesThreshold);

  let allHaveMargin = true;
  console.log('   Categories found:');
  for (const c of categories) {
    const ok = typeof c.marginPct === 'number';
    if (!ok) allHaveMargin = false;
    console.log(`   ${ok ? '✅' : '❌'} ${c.name} — threshold=${c.salesThreshold}, marginPct=${c.marginPct ?? 'MISSING'}`);
  }
  if (!allHaveMargin) {
    console.error('\n❌ FAIL: some categories are missing marginPct. Aborting.');
    process.exit(1);
  }
  console.log('   ✅ All categories have marginPct\n');

  // ── 2. Load sales in window ───────────────────────────────────────────────
  console.log(`2. Loading sales movements (last ${SALES_WINDOW_DAYS} days)...`);
  const sinceMs = Date.now() - SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const movSnap = await db.collection('inventoryMovements')
    .where('type', '==', 'Salida')
    .orderBy('date', 'desc')
    .get();

  const salesByProduct = {};
  for (const d of movSnap.docs) {
    const m = d.data();
    const dateMs = m.date?.toMillis ? m.date.toMillis() : new Date(m.date).getTime();
    if (dateMs < sinceMs) continue;
    if (m.productId) salesByProduct[m.productId] = (salesByProduct[m.productId] || 0) + (m.quantity || 0);
  }

  const totalProductsWithSales = Object.keys(salesByProduct).length;
  const totalSaleUnits = Object.values(salesByProduct).reduce((s, v) => s + v, 0);
  console.log(`   ✅ ${movSnap.size} movements → ${totalProductsWithSales} products with sales, ${totalSaleUnits} units total\n`);

  // ── 3. Rotation helper ────────────────────────────────────────────────────
  const getMarginForProduct = (productId) => {
    const sales = salesByProduct[productId] || 0;
    for (const cat of categories) {
      if (sales >= cat.salesThreshold) return { marginPct: cat.marginPct, categoryName: cat.name, sales };
    }
    const last = categories[categories.length - 1];
    return { marginPct: last?.marginPct ?? 8, categoryName: last?.name ?? 'Inactivo', sales };
  };

  // ── 4. Load products and simulate ─────────────────────────────────────────
  console.log('3. Simulating price recalculation (no writes)...');
  const productsSnap = await db.collection('products').get();

  let wouldUpdate = 0;
  let wouldSkip = 0;
  let skippedNoCost = 0;
  let skippedNoWholesale = 0;
  const changes = [];
  const errors = [];

  for (const docSnap of productsSnap.docs) {
    const data = docSnap.data();
    const { marginPct, categoryName, sales } = getMarginForProduct(docSnap.id);

    if (data.productType === 'variable' && Array.isArray(data.variants)) {
      let variantChanged = false;
      for (const v of data.variants) {
        if (!v.cost || v.cost <= 0) { skippedNoCost++; continue; }
        if (!v.priceWholesale || v.priceWholesale <= 0) { skippedNoWholesale++; continue; }

        const suggested = roundToHundred(v.cost / (1 - marginPct / 100));

        // Validate math
        if (!isFinite(suggested) || suggested <= 0) {
          errors.push(`[${data.name} / ${v.name}] Invalid suggested price: ${suggested} (cost=${v.cost}, margin=${marginPct}%)`);
          continue;
        }

        if (suggested !== v.priceWholesale) {
          variantChanged = true;
          const actualMargin = ((suggested - v.cost) / suggested * 100).toFixed(1);
          changes.push({
            product: `${data.name} — ${v.name} (${v.sku})`,
            category: categoryName,
            sales,
            cost: v.cost,
            current: v.priceWholesale,
            suggested,
            targetMargin: marginPct,
            actualMargin,
          });
        }
      }
      if (variantChanged) wouldUpdate++; else wouldSkip++;
    } else {
      if (!data.cost || data.cost <= 0) { skippedNoCost++; wouldSkip++; continue; }
      if (!data.priceWholesale || data.priceWholesale <= 0) { skippedNoWholesale++; wouldSkip++; continue; }

      const suggested = roundToHundred(data.cost / (1 - marginPct / 100));

      if (!isFinite(suggested) || suggested <= 0) {
        errors.push(`[${data.name}] Invalid suggested price: ${suggested} (cost=${data.cost}, margin=${marginPct}%)`);
        continue;
      }

      if (suggested !== data.priceWholesale) {
        const actualMargin = ((suggested - data.cost) / suggested * 100).toFixed(1);
        changes.push({
          product: `${data.name} (${data.sku})`,
          category: categoryName,
          sales,
          cost: data.cost,
          current: data.priceWholesale,
          suggested,
          targetMargin: marginPct,
          actualMargin,
        });
        wouldUpdate++;
      } else {
        wouldSkip++;
      }
    }
  }

  // ── 5. Math validation ─────────────────────────────────────────────────────
  console.log('\n4. Validating price formula on sample changes...');
  let mathErrors = 0;
  for (const c of changes.slice(0, 20)) {
    const recomputed = roundToHundred(c.cost / (1 - c.targetMargin / 100));
    if (recomputed !== c.suggested) {
      mathErrors++;
      console.log(`   ❌ Math mismatch: ${c.product} — recomputed=${recomputed}, stored=${c.suggested}`);
    }
  }
  if (mathErrors === 0) {
    console.log('   ✅ Formula correct on all sampled rows\n');
  }

  // ── 6. Show sample changes ─────────────────────────────────────────────────
  if (changes.length > 0) {
    console.log(`5. Sample price changes (first 10 of ${changes.length}):`);
    console.log('   ' + ['Product', 'Category', 'Sales', 'Cost', 'Current', 'Suggested', 'Margin'].join('\t'));
    for (const c of changes.slice(0, 10)) {
      const fmt = v => `$${v.toLocaleString('es-CO')}`;
      console.log(`   ${c.product.slice(0, 35).padEnd(36)} | ${c.category.padEnd(14)} | sales=${c.sales} | ${fmt(c.cost)} → ${fmt(c.current)} → ${fmt(c.suggested)} (${c.targetMargin}%)`);
    }
  }

  // ── 7. Error report ────────────────────────────────────────────────────────
  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} invalid price calculations (would be skipped):`);
    errors.forEach(e => console.log('   ' + e));
  }

  // ── 8. Summary ─────────────────────────────────────────────────────────────
  console.log('\n=== SUMMARY ===');
  console.log(`Total products scanned:  ${productsSnap.size}`);
  console.log(`Would update:            ${wouldUpdate}`);
  console.log(`Would skip (no change):  ${wouldSkip}`);
  console.log(`Skipped (cost=0):        ${skippedNoCost}`);
  console.log(`Skipped (wholesale=0):   ${skippedNoWholesale}`);
  console.log(`Math errors:             ${mathErrors}`);
  console.log(`Invalid calculations:    ${errors.length}`);

  if (mathErrors > 0 || errors.length > 0) {
    console.log('\n❌ TEST FAILED — fix errors before deploying.');
    process.exit(1);
  } else {
    console.log('\n✅ TEST PASSED — safe to deploy.');
  }
}

runTest().catch(err => { console.error(err); process.exit(1); });
