import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { syncWholesaleMarginsAction, type SyncPriceChange } from '@/app/actions/products';
import { uploadWholesaleReportExcel } from '@/lib/wholesale-sheet';

export const runtime = 'nodejs';
export const maxDuration = 300;

const fmt = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;

function buildEmailHtml(
    updated: number,
    increased: SyncPriceChange[],
    decreased: SyncPriceChange[],
    date: string,
    sheetUrl: string
): string {
    const tableStyle = 'border-collapse:collapse;width:100%;font-size:13px;';
    const thStyle = 'background:#1a1a2e;color:#fff;padding:8px 10px;text-align:left;';
    const tdStyle = 'padding:7px 10px;border-bottom:1px solid #e5e7eb;';

    const buildRows = (changes: SyncPriceChange[], direction: 'up' | 'down') =>
        changes.slice(0, 50).map(c => {
            const arrow = direction === 'up' ? '↑' : '↓';
            const color = direction === 'up' ? '#16a34a' : '#dc2626';
            return `<tr>
                <td style="${tdStyle}">${c.product}</td>
                <td style="${tdStyle}">${c.sku}</td>
                <td style="${tdStyle}">${c.category}</td>
                <td style="${tdStyle};text-align:center">${c.sales}</td>
                <td style="${tdStyle};text-align:right">${fmt(c.cost)}</td>
                <td style="${tdStyle};text-align:right">${fmt(c.oldPrice)}</td>
                <td style="${tdStyle};text-align:right;font-weight:600;color:${color}">${arrow} ${fmt(c.newPrice)}</td>
                <td style="${tdStyle};text-align:right;color:${color}">${direction === 'up' ? '+' : ''}${fmt(c.newPrice - c.oldPrice)}</td>
            </tr>`;
        }).join('');

    const tableHeader = `
        <tr>
            <th style="${thStyle}">Producto</th>
            <th style="${thStyle}">SKU</th>
            <th style="${thStyle}">Rotación</th>
            <th style="${thStyle};text-align:center">Ventas 30d</th>
            <th style="${thStyle};text-align:right">Costo</th>
            <th style="${thStyle};text-align:right">Precio Anterior</th>
            <th style="${thStyle};text-align:right">Precio Nuevo</th>
            <th style="${thStyle};text-align:right">Diferencia</th>
        </tr>`;

    const PREVIEW = 30;

    const seeAllLink = `<a href="${sheetUrl}" style="color:#2563eb;font-weight:600;font-size:13px">📊 Ver todos en Google Sheets →</a>`;

    const decreasedSection = decreased.length > 0 ? `
        <h2 style="color:#dc2626;margin-top:32px">⚠️ Bajaron de rotación — ${decreased.length} productos</h2>
        <p style="color:#6b7280;font-size:13px">Tenían ventas antes y ahora están inactivos. Su precio x mayor bajó.</p>
        <table style="${tableStyle}">
            ${tableHeader}
            ${buildRows(decreased, 'down')}
        </table>
        ${decreased.length > PREVIEW ? `<p style="margin-top:8px">${seeAllLink} <span style="color:#9ca3af;font-size:12px">(${decreased.length - PREVIEW} productos más en el archivo)</span></p>` : ''}
    ` : '<p style="color:#16a34a;margin-top:16px">✅ Ningún producto bajó de rotación hoy.</p>';

    const increasedSection = increased.length > 0 ? `
        <h2 style="color:#16a34a;margin-top:32px">🚀 Subieron de rotación — ${increased.length} productos</h2>
        <p style="color:#6b7280;font-size:13px">Ganaron ventas. Su precio x mayor subió para mantener el margen correcto.</p>
        <table style="${tableStyle}">
            ${tableHeader}
            ${buildRows(increased, 'up')}
        </table>
        ${increased.length > PREVIEW ? `<p style="margin-top:8px">${seeAllLink} <span style="color:#9ca3af;font-size:12px">(${increased.length - PREVIEW} productos más en el archivo)</span></p>` : ''}
    ` : '';

    return `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;color:#111">
        <div style="background:#1a1a2e;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">ADMA Inventario — Sincronización Precio x Mayor</h1>
            <p style="color:#9ca3af;margin:4px 0 0;font-size:13px">${date} · ${updated} productos actualizados</p>
        </div>
        <div style="background:#f9fafb;padding:16px 24px;border:1px solid #e5e7eb;border-top:none">
            <table style="border-collapse:collapse">
                <tr>
                    <td style="padding:8px 24px 8px 0;text-align:center">
                        <div style="font-size:26px;font-weight:700;color:#dc2626">${decreased.length}</div>
                        <div style="font-size:12px;color:#6b7280">↓ Bajaron precio</div>
                    </td>
                    <td style="padding:8px 24px;border-left:2px solid #e5e7eb;text-align:center">
                        <div style="font-size:26px;font-weight:700;color:#16a34a">${increased.length}</div>
                        <div style="font-size:12px;color:#6b7280">↑ Subieron precio</div>
                    </td>
                    <td style="padding:8px 24px;border-left:2px solid #e5e7eb;text-align:center">
                        <div style="font-size:26px;font-weight:700;color:#111">${updated}</div>
                        <div style="font-size:12px;color:#6b7280">Total actualizados</div>
                    </td>
                    <td style="padding:8px 0 8px 24px;border-left:2px solid #e5e7eb;vertical-align:middle">
                        <a href="${sheetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;font-size:13px">
                            ⬇️ Descargar Excel completo
                        </a>
                    </td>
                </tr>
            </table>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            ${decreasedSection}
            ${increasedSection}
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px">
            <p style="font-size:12px;color:#9ca3af;margin:0">
                Generado automáticamente cada día a las 3am (Bogotá) · ADMA Inventario
            </p>
        </div>
    </div>`;
}

async function sendSyncEmail(
    updated: number,
    increased: SyncPriceChange[],
    decreased: SyncPriceChange[]
) {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!gmailUser || !gmailPass) {
        console.warn('[cron] GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping email');
        return;
    }

    const date = new Date().toLocaleDateString('es-CO', {
        timeZone: 'America/Bogota',
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const shortDate = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });

    // Upload Excel to Firebase Storage
    let sheetUrl = '';
    try {
        sheetUrl = await uploadWholesaleReportExcel(increased, decreased, shortDate);
        console.log('[cron] Excel subido a Storage');
    } catch (err) {
        console.error('[cron] Error subiendo CSV:', err);
        sheetUrl = '#';
    }

    const subject = decreased.length > 0
        ? `⚠️ ADMA Precios x Mayor — ${decreased.length} bajaron de rotación · ${shortDate}`
        : `✅ ADMA Precios x Mayor — ${updated} actualizados · ${shortDate}`;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
        from: `"ADMA Inventario" <${gmailUser}>`,
        to: gmailUser,
        subject,
        html: buildEmailHtml(updated, increased, decreased, date, sheetUrl),
    });

    console.log(`[cron] Email enviado a ${gmailUser}`);
}

export async function POST(req: NextRequest) {
    const secret = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await syncWholesaleMarginsAction();

    if (result.success) {
        await sendSyncEmail(result.updated, result.increased, result.decreased).catch(err =>
            console.error('[cron] Email error:', err)
        );
    }

    return NextResponse.json(
        { ...result, increased: result.increased.length, decreased: result.decreased.length },
        { status: result.success ? 200 : 500 }
    );
}
