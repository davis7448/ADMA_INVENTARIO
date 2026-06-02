require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const XLSX = require('xlsx');

const STORAGE_BUCKET = 'studio-9748962172-82b35.firebasestorage.app';
const TEST_MODE = true; // ← cambiar a false para enviar a todos

const RECIPIENTS = TEST_MODE
  ? ['camilouseche22@gmail.com']
  : [
      'camilouseche22@gmail.com',
      'Mariagaray_15@hotmail.com',
      'directoracomercialadma@gmail.com',
      'coordinadoroperacionesadma@gmail.com',
    ];

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }), storageBucket: STORAGE_BUCKET });
}

const db = admin.firestore();
const round100 = v => Math.ceil(v / 100) * 100;
const fmt = v => '$' + Math.round(v).toLocaleString('es-CO');
const num = v => v.toLocaleString('es-CO');

// ── Sales aggregation ────────────────────────────────────────────────────────

async function getSalesByProduct() {
  const now = Date.now();
  const since30 = now - 30 * 86400000;
  const since7  = now - 7  * 86400000;
  const since1  = now - 1  * 86400000;

  const movs = await db.collection('inventoryMovements')
    .where('type', '==', 'Salida').orderBy('date', 'desc').get();

  const s30 = {}, s7 = {}, s1 = {};
  for (const d of movs.docs) {
    const m = d.data();
    const ms = m.date?.toMillis ? m.date.toMillis() : new Date(m.date).getTime();
    const pid = m.productId;
    if (!pid) continue;
    const qty = m.quantity || 0;
    if (ms >= since30) s30[pid] = (s30[pid] || 0) + qty;
    if (ms >= since7)  s7[pid]  = (s7[pid]  || 0) + qty;
    if (ms >= since1)  s1[pid]  = (s1[pid]  || 0) + qty;
  }
  return { s30, s7, s1 };
}

// ── Excel builder ────────────────────────────────────────────────────────────

async function uploadExcel(rows, stockRows, dateLabel) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 10 }, { wch: 42 }, { wch: 14 }, { wch: 14 },
    { wch: 10 }, { wch: 8  }, { wch: 8  }, { wch: 9  },
    { wch: 10 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cambios Precio');
  if (stockRows && stockRows.length > 0) {
    const wsStock = XLSX.utils.json_to_sheet(stockRows);
    wsStock['!cols'] = [{wch:8},{wch:12},{wch:42},{wch:14},{wch:14},{wch:10},{wch:8},{wch:8},{wch:12}];
    XLSX.utils.book_append_sheet(wb, wsStock, 'Alerta Stock');
  }
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const slug = dateLabel.replace(/\//g, '-');
  const file = admin.storage().bucket().file(`reportes/precio-x-mayor-${slug}.xlsx`);
  await file.save(buffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    metadata: { cacheControl: 'no-cache' },
  });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 86400000 });
  return url;
}

// ── Email HTML ────────────────────────────────────────────────────────────────

function buildEmailHtml(increased, decreased, lowStock, date, excelUrl) {
  const ts = 'border-collapse:collapse;width:100%;font-size:12px;';
  const th = 'background:#1a1a2e;color:#fff;padding:7px 8px;text-align:left;white-space:nowrap;font-size:11px';
  const td = 'padding:6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;';
  const PREVIEW = 30;

  const hdr = `<tr>
    <th style="${th}">Producto</th>
    <th style="${th}">SKU</th>
    <th style="${th}">Rotación</th>
    <th style="${th};text-align:right">30d</th>
    <th style="${th};text-align:right">7d</th>
    <th style="${th};text-align:right">Ayer</th>
    <th style="${th};text-align:right">Stock</th>
    <th style="${th};text-align:right">Días stock</th>
    <th style="${th};text-align:right">Costo</th>
    <th style="${th};text-align:right">P. Anterior</th>
    <th style="${th};text-align:right">P. Nuevo</th>
    <th style="${th};text-align:right">Diferencia</th>
  </tr>`;

  const buildRows = (changes, dir) => changes.slice(0, PREVIEW).map(c => {
    const col = dir === 'up' ? '#16a34a' : '#dc2626';
    const arr = dir === 'up' ? '↑' : '↓';
    const diasColor = c.diasStock !== null && c.diasStock <= 7 ? '#dc2626' : c.diasStock !== null && c.diasStock <= 15 ? '#d97706' : 'inherit';
    return `<tr>
      <td style="${td};max-width:220px;overflow:hidden;text-overflow:ellipsis" title="${c.product}">${c.product.length > 35 ? c.product.slice(0,35)+'…' : c.product}</td>
      <td style="${td};color:#9ca3af">${c.sku}</td>
      <td style="${td}">${c.category}</td>
      <td style="${td};text-align:right">${num(c.sales30)}</td>
      <td style="${td};text-align:right">${num(c.sales7)}</td>
      <td style="${td};text-align:right">${c.sales1 > 0 ? num(c.sales1) : '<span style="color:#d1d5db">—</span>'}</td>
      <td style="${td};text-align:right;font-weight:600">${num(c.stock)}</td>
      <td style="${td};text-align:right;font-weight:600;color:${diasColor}">${c.diasStock !== null ? num(c.diasStock)+'d' : '∞'}</td>
      <td style="${td};text-align:right">${fmt(c.cost)}</td>
      <td style="${td};text-align:right">${fmt(c.oldPrice)}</td>
      <td style="${td};text-align:right;font-weight:700;color:${col}">${arr} ${fmt(c.newPrice)}</td>
      <td style="${td};text-align:right;color:${col}">${dir==='up'?'+':''}${fmt(c.newPrice - c.oldPrice)}</td>
    </tr>`;
  }).join('');

  const seeMore = (n, label) => n > PREVIEW
    ? `<p style="margin-top:8px"><a href="${excelUrl}" style="color:#2563eb;font-weight:600;font-size:12px">⬇️ Ver los ${n} en Excel →</a> <span style="color:#9ca3af;font-size:11px">(${n - PREVIEW} ${label} más en el archivo)</span></p>`
    : '';

  const red   = lowStock.filter(p => p.diasStock <= 7);
  const amber = lowStock.filter(p => p.diasStock > 7 && p.diasStock <= 15);

  // Stock alert section
  const stockRow = (p, color) => `<tr>
    <td style="${td};max-width:220px;overflow:hidden;text-overflow:ellipsis" title="${p.product}">${p.product.length > 38 ? p.product.slice(0,38)+'…' : p.product}</td>
    <td style="${td};color:#9ca3af">${p.sku}</td>
    <td style="${td}">${p.category}</td>
    <td style="${td};text-align:right">${num(p.sales30)}</td>
    <td style="${td};text-align:right">${num(p.sales7)}</td>
    <td style="${td};text-align:right">${p.sales1 > 0 ? num(p.sales1) : '<span style=\"color:#d1d5db\">—</span>'}</td>
    <td style="${td};text-align:right;font-weight:700">${num(p.stock)}</td>
    <td style="${td};text-align:right;font-weight:700;color:${color}">${num(p.diasStock)}d</td>
  </tr>`;

  const stockHdr = `<tr>
    <th style="${th}">Producto</th>
    <th style="${th}">SKU</th>
    <th style="${th}">Rotación</th>
    <th style="${th};text-align:right">30d</th>
    <th style="${th};text-align:right">7d</th>
    <th style="${th};text-align:right">Ayer</th>
    <th style="${th};text-align:right">Stock</th>
    <th style="${th};text-align:right">Días</th>
  </tr>`;

  const redSection = red.length > 0 ? `
    <h3 style="color:#dc2626;margin:16px 0 8px;font-size:14px">🔴 Crítico — menos de 7 días (${red.length} productos)</h3>
    <div style="overflow-x:auto"><table style="${ts}">${stockHdr}${red.map(p => stockRow(p,'#dc2626')).join('')}</table></div>
  ` : '';

  const amberSection = amber.length > 0 ? `
    <h3 style="color:#d97706;margin:16px 0 8px;font-size:14px">🟠 Bajo — 8 a 15 días (${amber.length} productos)</h3>
    <div style="overflow-x:auto"><table style="${ts}">${stockHdr}${amber.map(p => stockRow(p,'#d97706')).join('')}</table></div>
  ` : '';

  const stockAlertSection = (red.length > 0 || amber.length > 0) ? `
    <h2 style="color:#111;margin-top:0;font-size:16px;padding-bottom:8px;border-bottom:2px solid #e5e7eb">⚠️ Alerta de Stock — ${red.length + amber.length} productos por agotarse</h2>
    ${redSection}
    ${amberSection}
    <div style="height:24px"></div>
    <hr style="border:none;border-top:2px solid #e5e7eb;margin-bottom:24px">
  ` : '';

    const decSection = decreased.length > 0 ? `
    <h2 style="color:#dc2626;margin-top:32px;font-size:15px">⚠️ Bajaron de rotación — ${decreased.length} productos</h2>
    <p style="color:#6b7280;font-size:12px;margin-top:4px">Tenían ventas antes y ahora están inactivos. Precio x mayor bajó.</p>
    <div style="overflow-x:auto"><table style="${ts}">${hdr}${buildRows(decreased,'down')}</table></div>
    ${seeMore(decreased.length, 'productos')}
  ` : '<p style="color:#16a34a;margin-top:16px">✅ Ningún producto bajó de rotación hoy.</p>';

  const incSection = increased.length > 0 ? `
    <h2 style="color:#16a34a;margin-top:32px;font-size:15px">🚀 Subieron de rotación — ${increased.length} productos</h2>
    <p style="color:#6b7280;font-size:12px;margin-top:4px">Ganaron ventas. Precio x mayor subió para reflejar el margen correcto.</p>
    <div style="overflow-x:auto"><table style="${ts}">${hdr}${buildRows(increased,'up')}</table></div>
    ${seeMore(increased.length, 'productos')}
  ` : '';

  return `
  <div style="font-family:Arial,sans-serif;max-width:1000px;margin:0 auto;color:#111">
    <div style="background:#1a1a2e;padding:20px 24px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:20px">ADMA Inventario — Reporte Precio x Mayor</h1>
      <p style="color:#9ca3af;margin:6px 0 0;font-size:13px">${date}${TEST_MODE ? ' · <span style="color:#f59e0b">MODO TEST — solo camilouseche22@gmail.com</span>' : ''}</p>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;border:1px solid #e5e7eb;border-top:none">
      <table style="border-collapse:collapse"><tr>
        <td style="padding:8px 24px 8px 0;text-align:center">
          <div style="font-size:26px;font-weight:700;color:#dc2626">${decreased.length}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">↓ Bajaron precio</div>
        </td>
        <td style="padding:8px 24px;border-left:2px solid #e5e7eb;text-align:center">
          <div style="font-size:26px;font-weight:700;color:#16a34a">${increased.length}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">↑ Subieron precio</div>
        </td>
        <td style="padding:8px 24px;border-left:2px solid #e5e7eb;text-align:center">
          <div style="font-size:26px;font-weight:700;color:#111">${increased.length + decreased.length}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">Total actualizados</div>
        </td>
        <td style="padding:8px 0 8px 24px;border-left:2px solid #e5e7eb;vertical-align:middle">
          <a href="${excelUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:13px">⬇️ Descargar Excel completo</a>
        </td>
      </tr></table>
    </div>
    <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
      ${stockAlertSection}
      ${decSection}
      ${incSection}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px">
      <p style="font-size:11px;color:#9ca3af;margin:0">
        ${date} · ADMA Inventario · Cron automático 3am Bogotá · Excel válido 7 días<br>
        <span style="color:#dc2626">Rojo</span> = menos de 7 días de stock · <span style="color:#d97706">Ámbar</span> = menos de 15 días
      </p>
    </div>
  </div>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Modo: ${TEST_MODE ? 'TEST (solo camilouseche22)' : 'PRODUCCIÓN (todos los destinatarios)'}`);
  console.log('Cargando datos...');

  const cats = (await db.collection('rotationCategories').get()).docs
    .map(d => d.data()).sort((a, b) => b.salesThreshold - a.salesThreshold);

  const { s30, s7, s1 } = await getSalesByProduct();
  console.log(`Ventas 30d: ${Object.keys(s30).length} productos con ventas`);

  const getCatInfo = pid => {
    const sales = s30[pid] || 0;
    for (const c of cats) if (sales >= c.salesThreshold) return { cat: c.name, m: c.marginPct ?? 8 };
    return { cat: 'Inactivo', m: 8 };
  };

  const getStock = (data) => {
    if (data.productType === 'variable' && Array.isArray(data.variants)) {
      return data.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    }
    return data.stock || 0;
  };

  const getDias = (stock, sales30) => {
    const daily = sales30 / 30;
    if (daily <= 0) return null; // sin ventas → stock infinito
    return Math.round(stock / daily);
  };

  const prods = await db.collection('products').get();
  const increased = [], decreased = [], lowStock = [];

  for (const doc of prods.docs) {
    const d = doc.data();
    const { cat, m } = getCatInfo(doc.id);
    const sales30 = s30[doc.id] || 0;
    const sales7  = s7[doc.id]  || 0;
    const sales1  = s1[doc.id]  || 0;

    // ── Stock alert scan (ALL products with sales) ──
    if (sales30 > 0) {
      if (d.productType === 'variable' && Array.isArray(d.variants)) {
        for (const v of d.variants) {
          const stock = v.stock || 0;
          const dias = getDias(stock, sales30);
          if (dias !== null && dias <= 15) {
            lowStock.push({ product: `${d.name} — ${v.name}`, sku: v.sku ?? '', category: cat, sales30, sales7, sales1, stock, diasStock: dias });
          }
        }
      } else {
        const stock = getStock(d);
        const dias = getDias(stock, sales30);
        if (dias !== null && dias <= 15) {
          lowStock.push({ product: d.name, sku: d.sku ?? '', category: cat, sales30, sales7, sales1, stock, diasStock: dias });
        }
      }
    }

    // ── Price change scan ──
    if (d.productType === 'variable' && Array.isArray(d.variants)) {
      for (const v of d.variants) {
        if (!v.cost || v.cost <= 0 || !v.priceWholesale || v.priceWholesale <= 0) continue;
        const sug = round100(v.cost / (1 - m / 100));
        if (sug === v.priceWholesale) continue;
        const stock = v.stock || 0;
        const c = {
          product: `${d.name} — ${v.name}`, sku: v.sku ?? '',
          category: cat, sales30, sales7, sales1,
          stock, diasStock: getDias(stock, sales30),
          marginPct: m, cost: v.cost, oldPrice: v.priceWholesale, newPrice: sug,
        };
        if (sug > v.priceWholesale) increased.push(c); else decreased.push(c);
      }
    } else {
      if (!d.cost || d.cost <= 0 || !d.priceWholesale || d.priceWholesale <= 0) continue;
      const sug = round100(d.cost / (1 - m / 100));
      if (sug === d.priceWholesale) continue;
      const stock = getStock(d);
      const c = {
        product: d.name, sku: d.sku ?? '',
        category: cat, sales30, sales7, sales1,
        stock, diasStock: getDias(stock, sales30),
        marginPct: m, cost: d.cost, oldPrice: d.priceWholesale, newPrice: sug,
      };
      if (sug > d.priceWholesale) increased.push(c); else decreased.push(c);
    }
  }

  increased.sort((a, b) => b.sales30 - a.sales30);
  decreased.sort((a, b) => b.sales30 - a.sales30);
  lowStock.sort((a, b) => a.diasStock - b.diasStock);
  const red    = lowStock.filter(p => p.diasStock <= 7);
  const amber  = lowStock.filter(p => p.diasStock > 7 && p.diasStock <= 15);
  console.log(`↓ Bajaron: ${decreased.length} | ↑ Subieron: ${increased.length} | 🔴 Stock crítico: ${red.length} | 🟠 Stock bajo: ${amber.length}`);

  // Build Excel rows
  const toExcelRow = (c, dir) => ({
    'Tipo':            dir === 'up' ? '↑ Subió' : '↓ Bajó',
    'Producto':        c.product,
    'SKU':             c.sku,
    'Rotación':        c.category,
    'Ventas 30d':      c.sales30,
    'Ventas 7d':       c.sales7,
    'Ventas ayer':     c.sales1,
    'Stock actual':    c.stock,
    'Días stock':      c.diasStock ?? '∞',
    'Margen %':        c.marginPct,
    'Costo':           Math.round(c.cost),
    'Precio Anterior': Math.round(c.oldPrice),
    'Precio Nuevo':    Math.round(c.newPrice),
    'Diferencia':      Math.round(c.newPrice - c.oldPrice),
  });

  const excelRows = [
    ...decreased.map(c => toExcelRow(c, 'down')),
    ...increased.map(c => toExcelRow(c, 'up')),
  ];

  const stockExcelRows = lowStock.map(p => ({
    'Días stock':   p.diasStock,
    'Alerta':       p.diasStock <= 7 ? '🔴 Crítico' : '🟠 Bajo',
    'Producto':     p.product,
    'SKU':          p.sku,
    'Rotación':     p.category,
    'Ventas 30d':   p.sales30,
    'Ventas 7d':    p.sales7,
    'Ventas ayer':  p.sales1,
    'Stock actual': p.stock,
  }));

  const shortDate = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  const date = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  console.log('Generando Excel...');
  const excelUrl = await uploadExcel(excelRows, stockExcelRows, shortDate);
  console.log('Excel listo');

  const subject = TEST_MODE
    ? `[TEST] ADMA Precios x Mayor · ${shortDate}`
    : decreased.length > 0
      ? `⚠️ ADMA Precios x Mayor — ${decreased.length} bajaron de rotación · ${shortDate}`
      : `✅ ADMA Precios x Mayor — ${increased.length + decreased.length} actualizados · ${shortDate}`;

  await nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } })
    .sendMail({ from: `"ADMA Inventario" <${process.env.GMAIL_USER}>`, to: RECIPIENTS, subject, html: buildEmailHtml(increased, decreased, lowStock, date, excelUrl) });

  console.log(`✅ Correo enviado a: ${RECIPIENTS.join(', ')}`);
  console.log(`   Asunto: ${subject}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
