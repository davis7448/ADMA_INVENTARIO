import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';
import { syncWholesaleMarginsAction, type SyncPriceChange } from '@/app/actions/products';
import { getApp } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const maxDuration = 300;

const STORAGE_BUCKET = 'studio-9748962172-82b35.firebasestorage.app';
const RECIPIENTS = [
    'camilouseche22@gmail.com',
    'Mariagaray_15@hotmail.com',
    'directoracomercialadma@gmail.com',
    'coordinadoroperacionesadma@gmail.com',
];

const fmt = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;
const num = (v: number) => (v ?? 0).toLocaleString('es-CO');

// ── Storage upload ────────────────────────────────────────────────────────────

async function uploadExcel(sheets: { name: string; rows: any[]; colWidths?: number[] }[], slug: string): Promise<string> {
    const wb = XLSX.utils.book_new();
    for (const { name, rows, colWidths } of sheets) {
        const ws = XLSX.utils.json_to_sheet(rows);
        if (colWidths) ws['!cols'] = colWidths.map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, name);
    }
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const adminApp = await getApp();
    const file = getStorage(adminApp).bucket(STORAGE_BUCKET).file(`reportes/${slug}-${Date.now()}.xlsx`);
    await file.save(buffer, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 86400000 });
    return url;
}

// ── Stock data ────────────────────────────────────────────────────────────────

type StockAlert = {
    product: string; sku: string; category: string;
    sales30: number; sales7: number; sales1: number;
    stock: number; diasStock: number;
};

async function getStockAlerts(
    s30: Record<string, number>,
    s7: Record<string, number>,
    s1: Record<string, number>,
    cats: { name: string; salesThreshold: number; marginPct?: number }[]
): Promise<{ red: StockAlert[]; amber: StockAlert[] }> {
    const adminApp = await getApp();
    const db = getFirestore(adminApp);
    const snap = await db.collection('products').get();

    const getCat = (pid: string) => {
        const sales = s30[pid] || 0;
        for (const c of cats) if (sales >= c.salesThreshold) return c.name;
        return 'Inactivo';
    };

    const alerts: StockAlert[] = [];

    for (const doc of snap.docs) {
        const d = doc.data();
        const sales30 = s30[doc.id] || 0;
        if (sales30 === 0) continue;

        const sales7 = s7[doc.id] || 0;
        const sales1 = s1[doc.id] || 0;
        const cat = getCat(doc.id);
        const daily = sales30 / 30;

        const items = d.productType === 'variable' && Array.isArray(d.variants)
            ? d.variants.map((v: any) => ({ name: `${d.name} — ${v.name}`, sku: v.sku ?? '', stock: v.stock || 0 }))
            : [{ name: d.name, sku: d.sku ?? '', stock: (d.stock || 0) }];

        for (const item of items) {
            const dias = Math.round(item.stock / daily);
            if (dias <= 15) alerts.push({ product: item.name, sku: item.sku, category: cat, sales30, sales7, sales1, stock: item.stock, diasStock: dias });
        }
    }

    alerts.sort((a, b) => a.diasStock - b.diasStock);
    return { red: alerts.filter(p => p.diasStock <= 7), amber: alerts.filter(p => p.diasStock > 7) };
}

// ── Email builders ────────────────────────────────────────────────────────────

function priceEmailHtml(increased: SyncPriceChange[], decreased: SyncPriceChange[], date: string, excelUrl: string): string {
    const ts = 'border-collapse:collapse;width:100%;font-size:12px;';
    const th = 'background:#1a1a2e;color:#fff;padding:7px 8px;text-align:left;white-space:nowrap;font-size:11px';
    const td = 'padding:6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;';
    const PREVIEW = 30;

    const hdr = `<tr>
        <th style="${th}">Producto</th><th style="${th}">SKU</th><th style="${th}">Rotación</th>
        <th style="${th};text-align:right">30d</th><th style="${th};text-align:right">7d</th><th style="${th};text-align:right">Ayer</th>
        <th style="${th};text-align:right">Costo</th><th style="${th};text-align:right">P. Anterior</th>
        <th style="${th};text-align:right">P. Nuevo</th><th style="${th};text-align:right">Diferencia</th>
    </tr>`;

    const rows = (ch: SyncPriceChange[], dir: 'up' | 'down') => ch.slice(0, PREVIEW).map(c => {
        const col = dir === 'up' ? '#16a34a' : '#dc2626', arr = dir === 'up' ? '↑' : '↓';
        return `<tr>
            <td style="${td}" title="${c.product}">${c.product.length > 38 ? c.product.slice(0,38)+'…' : c.product}</td>
            <td style="${td};color:#9ca3af">${c.sku}</td><td style="${td}">${c.category}</td>
            <td style="${td};text-align:right">${num(c.sales)}</td>
            <td style="${td};text-align:right">—</td><td style="${td};text-align:right">—</td>
            <td style="${td};text-align:right">${fmt(c.cost)}</td>
            <td style="${td};text-align:right">${fmt(c.oldPrice)}</td>
            <td style="${td};text-align:right;font-weight:700;color:${col}">${arr} ${fmt(c.newPrice)}</td>
            <td style="${td};text-align:right;color:${col}">${dir==='up'?'+':''}${fmt(c.newPrice - c.oldPrice)}</td>
        </tr>`;
    }).join('');

    const more = (n: number) => n > PREVIEW ? `<p style="margin-top:8px"><a href="${excelUrl}" style="color:#2563eb;font-weight:600;font-size:12px">⬇️ Ver todos en Excel →</a> <span style="color:#9ca3af;font-size:11px">(${n-PREVIEW} más)</span></p>` : '';

    const decSec = decreased.length > 0 ? `
        <h2 style="color:#dc2626;margin-top:28px;font-size:15px">⚠️ Bajaron de rotación — ${decreased.length} productos</h2>
        <p style="color:#6b7280;font-size:12px;margin-top:4px">Tenían ventas y ahora están inactivos. Precio x mayor bajó.</p>
        <div style="overflow-x:auto"><table style="${ts}">${hdr}${rows(decreased,'down')}</table></div>${more(decreased.length)}
    ` : '<p style="color:#16a34a;margin-top:16px">✅ Ningún producto bajó de rotación hoy.</p>';

    const incSec = increased.length > 0 ? `
        <h2 style="color:#16a34a;margin-top:28px;font-size:15px">🚀 Subieron de rotación — ${increased.length} productos</h2>
        <p style="color:#6b7280;font-size:12px;margin-top:4px">Ganaron ventas. Precio x mayor subió para mantener el margen.</p>
        <div style="overflow-x:auto"><table style="${ts}">${hdr}${rows(increased,'up')}</table></div>${more(increased.length)}
    ` : '';

    return `<div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#111">
        <div style="background:#1a1a2e;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:19px">ADMA — Ajustes de Precio x Mayor</h1>
            <p style="color:#9ca3af;margin:5px 0 0;font-size:12px">${date}</p>
        </div>
        <div style="background:#f9fafb;padding:14px 24px;border:1px solid #e5e7eb;border-top:none">
            <table style="border-collapse:collapse"><tr>
                <td style="padding:6px 20px 6px 0;text-align:center"><div style="font-size:26px;font-weight:700;color:#dc2626">${decreased.length}</div><div style="font-size:11px;color:#6b7280">↓ Bajaron</div></td>
                <td style="padding:6px 20px;border-left:2px solid #e5e7eb;text-align:center"><div style="font-size:26px;font-weight:700;color:#16a34a">${increased.length}</div><div style="font-size:11px;color:#6b7280">↑ Subieron</div></td>
                <td style="padding:6px 20px;border-left:2px solid #e5e7eb;text-align:center"><div style="font-size:26px;font-weight:700;color:#111">${increased.length+decreased.length}</div><div style="font-size:11px;color:#6b7280">Total</div></td>
                <td style="padding:6px 0 6px 20px;border-left:2px solid #e5e7eb;vertical-align:middle"><a href="${excelUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-weight:600;font-size:13px">⬇️ Excel completo</a></td>
            </tr></table>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">${decSec}${incSec}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">
            <p style="font-size:11px;color:#9ca3af;margin:0">${date} · ADMA Inventario · Excel válido 7 días</p>
        </div>
    </div>`;
}

function stockEmailHtml(red: StockAlert[], amber: StockAlert[], date: string, excelUrl: string): string {
    const ts = 'border-collapse:collapse;width:100%;font-size:12px;';
    const th = 'background:#7f1d1d;color:#fff;padding:7px 8px;text-align:left;white-space:nowrap;font-size:11px';
    const td = 'padding:6px 8px;border-bottom:1px solid #fecaca;white-space:nowrap;';

    const hdr = `<tr>
        <th style="${th}">Producto</th><th style="${th}">SKU</th><th style="${th}">Rotación</th>
        <th style="${th};text-align:right">30d</th><th style="${th};text-align:right">7d</th><th style="${th};text-align:right">Ayer</th>
        <th style="${th};text-align:right">Stock</th><th style="${th};text-align:right">Días</th>
    </tr>`;

    const buildRows = (items: StockAlert[], color: string) => items.map(p => `<tr>
        <td style="${td}" title="${p.product}">${p.product.length > 40 ? p.product.slice(0,40)+'…' : p.product}</td>
        <td style="${td};color:#9ca3af">${p.sku}</td><td style="${td}">${p.category}</td>
        <td style="${td};text-align:right">${num(p.sales30)}</td>
        <td style="${td};text-align:right">${num(p.sales7)}</td>
        <td style="${td};text-align:right">${p.sales1 > 0 ? num(p.sales1) : '<span style="color:#d1d5db">—</span>'}</td>
        <td style="${td};text-align:right;font-weight:700">${num(p.stock)}</td>
        <td style="${td};text-align:right;font-weight:700;color:${color}">${num(p.diasStock)}d</td>
    </tr>`).join('');

    const redSec = red.length > 0 ? `
        <h2 style="color:#dc2626;margin-top:0;font-size:15px">🔴 Crítico — menos de 7 días (${red.length} productos)</h2>
        <p style="color:#6b7280;font-size:12px;margin-top:4px">Riesgo de quiebre de stock esta semana.</p>
        <div style="overflow-x:auto"><table style="${ts}">${hdr}${buildRows(red,'#dc2626')}</table></div>
    ` : '';

    const amberSec = amber.length > 0 ? `
        <h2 style="color:#d97706;margin-top:${red.length > 0 ? '28px' : '0'};font-size:15px">🟠 Bajo — 8 a 15 días (${amber.length} productos)</h2>
        <p style="color:#6b7280;font-size:12px;margin-top:4px">Stock para menos de dos semanas.</p>
        <div style="overflow-x:auto"><table style="${ts}">${hdr}${buildRows(amber,'#d97706')}</table></div>
    ` : '';

    return `<div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#111">
        <div style="background:#7f1d1d;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:19px">ADMA — ⚠️ Alerta de Stock</h1>
            <p style="color:#fca5a5;margin:5px 0 0;font-size:12px">${date}</p>
        </div>
        <div style="background:#fff7f7;padding:14px 24px;border:1px solid #fecaca;border-top:none">
            <table style="border-collapse:collapse"><tr>
                <td style="padding:6px 20px 6px 0;text-align:center"><div style="font-size:26px;font-weight:700;color:#dc2626">${red.length}</div><div style="font-size:11px;color:#6b7280">🔴 Crítico ≤7d</div></td>
                <td style="padding:6px 20px;border-left:2px solid #fecaca;text-align:center"><div style="font-size:26px;font-weight:700;color:#d97706">${amber.length}</div><div style="font-size:11px;color:#6b7280">🟠 Bajo 8–15d</div></td>
                <td style="padding:6px 20px;border-left:2px solid #fecaca;text-align:center"><div style="font-size:26px;font-weight:700;color:#111">${red.length+amber.length}</div><div style="font-size:11px;color:#6b7280">Total en alerta</div></td>
                <td style="padding:6px 0 6px 20px;border-left:2px solid #fecaca;vertical-align:middle"><a href="${excelUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-weight:600;font-size:13px">⬇️ Excel completo</a></td>
            </tr></table>
        </div>
        <div style="padding:24px;border:1px solid #fecaca;border-top:none;border-radius:0 0 8px 8px">${redSec}${amberSec}
            <hr style="border:none;border-top:1px solid #fee2e2;margin:24px 0 12px">
            <p style="font-size:11px;color:#9ca3af;margin:0">${date} · ADMA Inventario · Excel válido 7 días</p>
        </div>
    </div>`;
}

// ── Cron handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const secret = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass) {
        return NextResponse.json({ error: 'GMAIL_USER or GMAIL_APP_PASSWORD not configured' }, { status: 500 });
    }

    // 1. Sync prices
    const syncResult = await syncWholesaleMarginsAction();
    if (!syncResult.success) {
        return NextResponse.json({ error: syncResult.message }, { status: 500 });
    }

    const adminApp = await getApp();
    const db = getFirestore(adminApp);
    const shortDate = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
    const date = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
    const send = (subject: string, html: string) => transporter.sendMail({ from: `"ADMA Inventario" <${gmailUser}>`, to: RECIPIENTS, subject, html });

    // 2. Load sales for stock alert
    const now = Date.now();
    const movSnap = await db.collection('inventoryMovements').where('type', '==', 'Salida').orderBy('date', 'desc').get();
    const s30: Record<string, number> = {}, s7: Record<string, number> = {}, s1: Record<string, number> = {};
    for (const d of movSnap.docs) {
        const m = d.data();
        const ms = m.date?.toMillis ? m.date.toMillis() : new Date(m.date).getTime();
        const pid = m.productId; if (!pid) continue;
        const qty = m.quantity || 0;
        if (ms >= now - 30 * 86400000) s30[pid] = (s30[pid] || 0) + qty;
        if (ms >= now -  7 * 86400000) s7[pid]  = (s7[pid]  || 0) + qty;
        if (ms >= now -      86400000) s1[pid]  = (s1[pid]  || 0) + qty;
    }

    const catSnap = await db.collection('rotationCategories').get();
    const cats = catSnap.docs.map(d => d.data() as { name: string; salesThreshold: number }).sort((a, b) => b.salesThreshold - a.salesThreshold);
    const { red, amber } = await getStockAlerts(s30, s7, s1, cats);

    // 3. Email 1 — Price adjustments
    const priceExcelUrl = await uploadExcel([{
        name: 'Cambios Precio',
        rows: [
            ...syncResult.decreased.map(c => ({ 'Tipo': '↓ Bajó', 'Producto': c.product, 'SKU': c.sku, 'Rotación': c.category, 'Ventas 30d': c.sales, 'Margen %': c.marginPct, 'Costo': Math.round(c.cost), 'Precio Anterior': Math.round(c.oldPrice), 'Precio Nuevo': Math.round(c.newPrice), 'Diferencia': Math.round(c.newPrice - c.oldPrice) })),
            ...syncResult.increased.map(c => ({ 'Tipo': '↑ Subió', 'Producto': c.product, 'SKU': c.sku, 'Rotación': c.category, 'Ventas 30d': c.sales, 'Margen %': c.marginPct, 'Costo': Math.round(c.cost), 'Precio Anterior': Math.round(c.oldPrice), 'Precio Nuevo': Math.round(c.newPrice), 'Diferencia': Math.round(c.newPrice - c.oldPrice) })),
        ],
        colWidths: [8, 42, 14, 14, 10, 8, 12, 16, 13, 12],
    }], `precios-${shortDate}`);

    const priceSubject = syncResult.decreased.length > 0
        ? `⚠️ ADMA Precio x Mayor — ${syncResult.decreased.length} bajaron · ${shortDate}`
        : `✅ ADMA Precio x Mayor — ${syncResult.updated} actualizados · ${shortDate}`;

    await send(priceSubject, priceEmailHtml(syncResult.increased, syncResult.decreased, date, priceExcelUrl));

    // 4. Email 2 — Stock alerts (solo si hay alertas)
    let stockSent = false;
    if (red.length > 0 || amber.length > 0) {
        const stockExcelUrl = await uploadExcel([{
            name: 'Alerta Stock',
            rows: [...red, ...amber].map(p => ({ 'Alerta': p.diasStock <= 7 ? '🔴 Crítico' : '🟠 Bajo', 'Días restantes': p.diasStock, 'Producto': p.product, 'SKU': p.sku, 'Rotación': p.category, 'Ventas 30d': p.sales30, 'Ventas 7d': p.sales7, 'Ventas ayer': p.sales1, 'Stock actual': p.stock })),
            colWidths: [11, 14, 42, 14, 14, 10, 8, 8, 12],
        }], `stock-${shortDate}`);

        const stockSubject = `⚠️ ADMA Alerta Stock — ${red.length} críticos, ${amber.length} bajos · ${shortDate}`;
        await send(stockSubject, stockEmailHtml(red, amber, date, stockExcelUrl));
        stockSent = true;
    }

    return NextResponse.json({
        success: true,
        pricesUpdated: syncResult.updated,
        increased: syncResult.increased.length,
        decreased: syncResult.decreased.length,
        stockRed: red.length,
        stockAmber: amber.length,
        stockEmailSent: stockSent,
    });
}
