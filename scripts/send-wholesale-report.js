require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const STORAGE_BUCKET = 'studio-9748962172-82b35.firebasestorage.app';

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }), storageBucket: STORAGE_BUCKET });
}

const db = admin.firestore();
const DAYS = 30, PREVIEW = 30;
const round100 = v => Math.ceil(v / 100) * 100;
const fmt = v => '$' + Math.round(v).toLocaleString('es-CO');

async function uploadCsvAndGetLink(increased, decreased, dateLabel) {
  const header = 'Tipo,Producto,Variante,SKU,Rotacion,Ventas 30d,Margen %,Costo,Precio Anterior,Precio Nuevo,Diferencia\n';
  const toRow = (c, dir) => [
    dir==='up'?'Subio':'Bajo',
    `"${c.product}"`, '', c.sku, c.category, c.sales, c.marginPct+'%',
    Math.round(c.cost), Math.round(c.oldPrice), Math.round(c.newPrice),
    Math.round(c.newPrice - c.oldPrice)
  ].join(',');

  const csv = header
    + decreased.map(c => toRow(c,'down')).join('\n')
    + (decreased.length && increased.length ? '\n' : '')
    + increased.map(c => toRow(c,'up')).join('\n');

  const filename = `reportes/precio-x-mayor-${dateLabel.replace(/\//g,'-')}.csv`;
  const file = admin.storage().bucket().file(filename);

  await file.save(csv, { contentType: 'text/csv; charset=utf-8', metadata: { cacheControl: 'no-cache' } });

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return url;
}

function buildEmailHtml(increased, decreased, date, csvUrl) {
  const ts = 'border-collapse:collapse;width:100%;font-size:13px;';
  const th = 'background:#1a1a2e;color:#fff;padding:8px 10px;text-align:left;white-space:nowrap';
  const td = 'padding:7px 10px;border-bottom:1px solid #e5e7eb;';
  const hdr = `<tr>
    <th style="${th}">Producto</th><th style="${th}">SKU</th>
    <th style="${th}">Rotación</th><th style="${th};text-align:center">Ventas 30d</th>
    <th style="${th};text-align:right">Costo</th><th style="${th};text-align:right">Precio Anterior</th>
    <th style="${th};text-align:right">Precio Nuevo</th><th style="${th};text-align:right">Diferencia</th>
  </tr>`;

  const buildRows = (ch, dir) => ch.slice(0, PREVIEW).map(c => {
    const col = dir==='up' ? '#16a34a' : '#dc2626', arr = dir==='up' ? '↑' : '↓';
    return `<tr>
      <td style="${td}">${c.product}</td>
      <td style="${td};color:#9ca3af">${c.sku}</td>
      <td style="${td}">${c.category}</td>
      <td style="${td};text-align:center">${c.sales}</td>
      <td style="${td};text-align:right">${fmt(c.cost)}</td>
      <td style="${td};text-align:right">${fmt(c.oldPrice)}</td>
      <td style="${td};text-align:right;font-weight:600;color:${col}">${arr} ${fmt(c.newPrice)}</td>
      <td style="${td};text-align:right;color:${col}">${dir==='up'?'+':''}${fmt(c.newPrice - c.oldPrice)}</td>
    </tr>`;
  }).join('');

  const downloadBtn = `<a href="${csvUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:13px">⬇️ Descargar CSV completo</a>`;
  const seeMore = n => n > PREVIEW ? `<p style="margin-top:8px"><a href="${csvUrl}" style="color:#2563eb;font-weight:600;font-size:13px">⬇️ Ver todos en el archivo →</a> <span style="color:#9ca3af;font-size:12px">(${n - PREVIEW} productos más)</span></p>` : '';

  const decSection = decreased.length > 0 ? `
    <h2 style="color:#dc2626;margin-top:32px;font-size:16px">⚠️ Bajaron de rotación — ${decreased.length} productos</h2>
    <p style="color:#6b7280;font-size:13px;margin-top:4px">Tenían ventas antes y ahora están inactivos. Su precio x mayor bajó.</p>
    <table style="${ts}">${hdr}${buildRows(decreased,'down')}</table>
    ${seeMore(decreased.length)}
  ` : '<p style="color:#16a34a;margin-top:16px">✅ Ningún producto bajó de rotación hoy.</p>';

  const incSection = increased.length > 0 ? `
    <h2 style="color:#16a34a;margin-top:32px;font-size:16px">🚀 Subieron de rotación — ${increased.length} productos</h2>
    <p style="color:#6b7280;font-size:13px;margin-top:4px">Ganaron ventas. Su precio x mayor subió para mantener el margen correcto.</p>
    <table style="${ts}">${hdr}${buildRows(increased,'up')}</table>
    ${seeMore(increased.length)}
  ` : '';

  return `
  <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;color:#111">
    <div style="background:#1a1a2e;padding:20px 24px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:20px">ADMA Inventario — Reporte Precio x Mayor</h1>
      <p style="color:#9ca3af;margin:6px 0 0;font-size:13px">${date}</p>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;border:1px solid #e5e7eb;border-top:none">
      <table style="border-collapse:collapse"><tr>
        <td style="padding:8px 24px 8px 0;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#dc2626">${decreased.length}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">↓ Bajaron precio</div>
        </td>
        <td style="padding:8px 24px;border-left:2px solid #e5e7eb;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#16a34a">${increased.length}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">↑ Subieron precio</div>
        </td>
        <td style="padding:8px 24px;border-left:2px solid #e5e7eb;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#111">${increased.length + decreased.length}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">Total actualizados</div>
        </td>
        <td style="padding:8px 0 8px 24px;border-left:2px solid #e5e7eb;vertical-align:middle">
          ${downloadBtn}
        </td>
      </tr></table>
    </div>
    <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
      ${decSection}
      ${incSection}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px">
      <p style="font-size:12px;color:#9ca3af;margin:0">
        Reporte generado el ${date} · ADMA Inventario<br>
        Los cambios se aplican automáticamente cada día a las 3am (hora Bogotá).<br>
        El enlace de descarga expira en 7 días.
      </p>
    </div>
  </div>`;
}

async function main() {
  console.log('Generando datos...');
  const cats = (await db.collection('rotationCategories').get()).docs.map(d=>d.data()).sort((a,b)=>b.salesThreshold-a.salesThreshold);
  const sinceMs = Date.now() - DAYS * 86400000;
  const movs = await db.collection('inventoryMovements').where('type','==','Salida').orderBy('date','desc').get();
  const sales = {};
  for (const d of movs.docs) {
    const m = d.data();
    const ms = m.date?.toMillis ? m.date.toMillis() : new Date(m.date).getTime();
    if (ms < sinceMs) continue;
    if (m.productId) sales[m.productId] = (sales[m.productId]||0) + (m.quantity||0);
  }
  const getInfo = pid => { const s=sales[pid]||0; for(const c of cats) if(s>=c.salesThreshold) return {cat:c.name,m:c.marginPct??8,s}; return {cat:'Inactivo',m:8,s:0}; };
  const prods = await db.collection('products').get();
  const increased=[], decreased=[];
  for (const doc of prods.docs) {
    const d=doc.data(), {cat,m,s}=getInfo(doc.id);
    if (d.productType==='variable' && Array.isArray(d.variants)) {
      for (const v of d.variants) {
        if (!v.cost||v.cost<=0||!v.priceWholesale||v.priceWholesale<=0) continue;
        const sug=round100(v.cost/(1-m/100)); if(sug===v.priceWholesale) continue;
        const c={product:`${d.name} — ${v.name}`,sku:v.sku??'',category:cat,sales:s,marginPct:m,cost:v.cost,oldPrice:v.priceWholesale,newPrice:sug};
        if(sug>v.priceWholesale) increased.push(c); else decreased.push(c);
      }
    } else {
      if (!d.cost||d.cost<=0||!d.priceWholesale||d.priceWholesale<=0) continue;
      const sug=round100(d.cost/(1-m/100)); if(sug===d.priceWholesale) continue;
      const c={product:d.name,sku:d.sku??'',category:cat,sales:s,marginPct:m,cost:d.cost,oldPrice:d.priceWholesale,newPrice:sug};
      if(sug>d.priceWholesale) increased.push(c); else decreased.push(c);
    }
  }
  increased.sort((a,b)=>b.sales-a.sales); decreased.sort((a,b)=>b.sales-a.sales);
  console.log(`↓ Bajaron: ${decreased.length} | ↑ Subieron: ${increased.length}`);

  const shortDate = new Date().toLocaleDateString('es-CO',{timeZone:'America/Bogota'});
  const date = new Date().toLocaleDateString('es-CO',{timeZone:'America/Bogota',weekday:'long',year:'numeric',month:'long',day:'numeric'});

  console.log('Subiendo CSV a Firebase Storage...');
  const csvUrl = await uploadCsvAndGetLink(increased, decreased, shortDate);
  console.log('CSV disponible en link firmado (7 días)');

  const subject = decreased.length > 0
    ? `⚠️ ADMA Precios x Mayor — ${decreased.length} bajaron de rotación · ${shortDate}`
    : `✅ ADMA Precios x Mayor — ${increased.length + decreased.length} actualizados · ${shortDate}`;

  await nodemailer.createTransport({ service:'gmail', auth:{ user:process.env.GMAIL_USER, pass:process.env.GMAIL_APP_PASSWORD } })
    .sendMail({ from:`"ADMA Inventario" <${process.env.GMAIL_USER}>`, to:process.env.GMAIL_USER, subject, html:buildEmailHtml(increased,decreased,date,csvUrl) });

  console.log(`✅ Correo enviado · Asunto: ${subject}`);
}

main().catch(e=>{console.error(e.message);process.exit(1);});
