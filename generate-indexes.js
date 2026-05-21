#!/usr/bin/env node
/**
 * Generates and merges all required Firestore composite indexes.
 * Run once: node generate-indexes.js
 * Then: firebase deploy --only firestore:indexes
 */
const fs = require('fs');
const path = require('path');

const indexFile = path.join(__dirname, 'firestore.indexes.json');
const current = JSON.parse(fs.readFileSync(indexFile, 'utf8'));

function asc(fieldPath) { return { fieldPath, order: 'ASCENDING' }; }
function desc(fieldPath) { return { fieldPath, order: 'DESCENDING' }; }

// Generate all non-empty subsets of fields array (preserving order)
function subsets(fields) {
  const result = [];
  const n = fields.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const subset = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subset.push(fields[i]);
    }
    result.push(subset);
  }
  return result;
}

// Build composite index entry: equality fields (ASC) + trailing date DESC
function buildIndex(collection, eqFields, trailingField = 'date') {
  return {
    collectionGroup: collection,
    queryScope: 'COLLECTION',
    fields: [...eqFields.map(asc), desc(trailingField)],
  };
}

function indexKey(idx) {
  return idx.collectionGroup + '|' + idx.fields.map(f => f.fieldPath + ':' + (f.order || f.arrayConfig || '')).join(',');
}

const existingKeys = new Set(current.indexes.map(indexKey));
const toAdd = [];

function addIfNew(idx) {
  const key = indexKey(idx);
  if (!existingKeys.has(key)) {
    existingKeys.add(key);
    toAdd.push(idx);
  }
}

// ── inventoryMovements matrix ──────────────────────────────────────────────
// Canonical order: warehouseId, productId, platformId, carrierId, type, userId
const movEqFields = ['warehouseId', 'productId', 'platformId', 'carrierId', 'type', 'userId'];
for (const subset of subsets(movEqFields)) {
  addIfNew(buildIndex('inventoryMovements', subset, 'date'));
}
// Extra: type + dispatchId (data-reconciliation.ts:27-30) — no date
addIfNew({
  collectionGroup: 'inventoryMovements',
  queryScope: 'COLLECTION',
  fields: [asc('type'), asc('dispatchId')],
});

// ── dispatchOrders matrix ──────────────────────────────────────────────────
// Canonical order: warehouseId, platformId, carrierId, status, createdBy.id
const ordEqFields = ['warehouseId', 'platformId', 'carrierId', 'status', 'createdBy.id'];
for (const subset of subsets(ordEqFields)) {
  addIfNew(buildIndex('dispatchOrders', subset, 'date'));
}

// ── App-wide missing indexes ───────────────────────────────────────────────

// cancellationRequests: trackingNumber + status
addIfNew({ collectionGroup: 'cancellationRequests', queryScope: 'COLLECTION', fields: [asc('trackingNumber'), asc('status')] });

// return_guides: warehouseId+createdAt, carrierId+createdAt, warehouseId+carrierId+createdAt
addIfNew(buildIndex('return_guides', ['warehouseId'], 'createdAt'));
addIfNew(buildIndex('return_guides', ['carrierId'], 'createdAt'));
addIfNew(buildIndex('return_guides', ['warehouseId', 'carrierId'], 'createdAt'));

// commercial_ratings: from_user_id + created_at
addIfNew({ collectionGroup: 'commercial_ratings', queryScope: 'COLLECTION', fields: [asc('from_user_id'), asc('created_at')] });

// commercial_challenges: is_active + type
addIfNew({ collectionGroup: 'commercial_challenges', queryScope: 'COLLECTION', fields: [asc('is_active'), asc('type')] });

// client_tests: clientId + created_at DESC
addIfNew({ collectionGroup: 'client_tests', queryScope: 'COLLECTION', fields: [asc('clientId'), desc('created_at')] });

// client_events: clientId + event_number DESC
addIfNew({ collectionGroup: 'client_events', queryScope: 'COLLECTION', fields: [asc('clientId'), desc('event_number')] });

// challenges: communityId + status + endDate
addIfNew({ collectionGroup: 'challenges', queryScope: 'COLLECTION', fields: [asc('communityId'), asc('status'), asc('endDate')] });

// dropshipping_requests: status + userId + createdAt DESC
addIfNew({ collectionGroup: 'dropshipping_requests', queryScope: 'COLLECTION', fields: [asc('status'), asc('userId'), desc('createdAt')] });

// MCI_COLLECTION indexes — constant name resolved at runtime; collection name needs verification
// These will be added under placeholder names — update collectionGroup after confirming the constant value
// userId + weekNumber + year
addIfNew({ collectionGroup: 'mci_data', queryScope: 'COLLECTION', fields: [asc('userId'), asc('weekNumber'), asc('year')] });
// weekNumber + year + completionPercentage DESC
addIfNew({ collectionGroup: 'mci_data', queryScope: 'COLLECTION', fields: [asc('weekNumber'), asc('year'), desc('completionPercentage')] });
// userId + year DESC + weekNumber DESC
addIfNew({ collectionGroup: 'mci_data', queryScope: 'COLLECTION', fields: [asc('userId'), desc('year'), desc('weekNumber')] });

// Write result
const merged = { ...current, indexes: [...current.indexes, ...toAdd] };
fs.writeFileSync(indexFile, JSON.stringify(merged, null, 2) + '\n');
console.log(`Added ${toAdd.length} new indexes. Total: ${merged.indexes.length}`);
