require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const XLSX = require('xlsx');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  })});
}

const db = admin.firestore();
const SALES_WINDOW_DAYS = 30;
const roundToHundred = v => Math.ceil(v / 100) * 100;

async function main() {
  const catSnap = await db.collection('rotationCategories').get();
  const categories = catSnap.docs.map(d => ({ ...d.data() })).sort((a,b) => b.salesThreshold - a.salesThreshold);

  const sinceMs = Date.now() - SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const movSnap = await db.collection('inventoryMovements').where('type','==','Salida').orderBy('date','desc').get();
  const salesByProduct = {};
  for (const d of movSnap.docs) {
    const m = d.data();
    const dateMs = m.date?.toMillis ? m.date.toMillis() : new Date(m.date).getTime();
    if (dateMs < sinceMs) continue;
    if (m.productId) salesByProduct[m.productId] = (salesByProduct[m.productId] || 0) + (m.quantity || 0);
  }

  const getInfo = (productId) => {
    const sales = salesByProduct[productId] || 0;
    for (const cat of categories) {
      if (sales >= cat.salesThreshold) return { category: cat.name, marginPct: cat.marginPct ?? 8, sales };
    }
    return { category: categories[categories.length-1]?.name ?? 'Inactivo', marginPct: 8, sales };
  };

  const productsSnap = await db.collection('products').get();
  const rows = [];

  for (const docSnap of productsSnap.docs) {
    const data = docSnap.data();
    const { category, marginPct, sales } = getInfo(docSnap.id);

    if (data.productType === 'variable' && Array.isArray(data.variants)) {
      for (const v of data.variants) {
        if (!v.cost || v.cost <= 0 || !v.priceWholesale || v.priceWholesale <= 0) continue;
        const suggested = roundToHundred(v.cost / (1 - marginPct / 100));
        if (suggested !== v.priceWholesale) {
          rows.push({
            'Tipo': 'Variante',
            'Producto': data.name,
            'Variante': v.name,
            'SKU': v.sku ?? '',
            'Rotación': category,
            'Ventas 30d': sales,
            'Margen %': marginPct,
            'Costo': v.cost,
            'Precio Mayor Actual': v.priceWholesale,
            'Precio Mayor Nuevo': suggested,
            'Diferencia': suggested - v.priceWholesale,
          });
        }
      }
    } else {
      if (!data.cost || data.cost <= 0 || !data.priceWholesale || data.priceWholesale <= 0) continue;
      const suggested = roundToHundred(data.cost / (1 - marginPct / 100));
      if (suggested !== data.priceWholesale) {
        rows.push({
          'Tipo': 'Simple',
          'Producto': data.name,
          'Variante': '',
          'SKU': data.sku ?? '',
          'Rotación': category,
          'Ventas 30d': sales,
          'Margen %': marginPct,
          'Costo': data.cost,
          'Precio Mayor Actual': data.priceWholesale,
          'Precio Mayor Nuevo': suggested,
          'Diferencia': suggested - data.priceWholesale,
        });
      }
    }
  }

  rows.sort((a, b) => b['Ventas 30d'] - a['Ventas 30d']);

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [6,30,25,12,14,10,8,12,16,16,12].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cambios');
  const path = '/tmp/cambios-precio-mayor.xlsx';
  XLSX.writeFile(wb, path);
  console.log(`Exported ${rows.length} rows to ${path}`);

  // Summary by rotation
  const byRotation = {};
  for (const r of rows) {
    byRotation[r['Rotación']] = (byRotation[r['Rotación']] || 0) + 1;
  }
  console.log('\nPor categoría de rotación:');
  Object.entries(byRotation).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
}

main().catch(e => { console.error(e); process.exit(1); });
