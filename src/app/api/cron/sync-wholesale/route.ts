import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { syncWholesaleMarginsAction, type SyncPriceChange } from '@/app/actions/products';

export const runtime = 'nodejs';
export const maxDuration = 300;

const fmt = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;

function buildEmailHtml(
    updated: number,
    increased: SyncPriceChange[],
    decreased: SyncPriceChange[],
    date: string
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

    const decreasedSection = decreased.length > 0 ? `
        <h2 style="color:#dc2626;margin-top:32px">⚠️ Bajaron de rotación — ${decreased.length} productos</h2>
        <p style="color:#6b7280;font-size:13px">Estos productos tenían ventas antes y ahora están inactivos. Su precio x mayor bajó.</p>
        <table style="${tableStyle}">
            ${tableHeader}
            ${buildRows(decreased, 'down')}
        </table>
        ${decreased.length > 50 ? `<p style="color:#6b7280;font-size:12px">... y ${decreased.length - 50} más</p>` : ''}
    ` : '<p style="color:#16a34a">✅ Ningún producto bajó de rotación hoy.</p>';

    const increasedSection = increased.length > 0 ? `
        <h2 style="color:#16a34a;margin-top:32px">🚀 Subieron de rotación — ${increased.length} productos</h2>
        <p style="color:#6b7280;font-size:13px">Estos productos ganaron ventas. Su precio x mayor subió para reflejar el nuevo margen.</p>
        <table style="${tableStyle}">
            ${tableHeader}
            ${buildRows(increased, 'up')}
        </table>
        ${increased.length > 50 ? `<p style="color:#6b7280;font-size:12px">... y ${increased.length - 50} más</p>` : ''}
    ` : '';

    return `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;color:#111">
        <div style="background:#1a1a2e;padding:20px 24px;border-radius:8px 8px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px">ADMA Inventario — Sincronización Precio x Mayor</h1>
            <p style="color:#9ca3af;margin:4px 0 0;font-size:13px">${date} · ${updated} productos actualizados</p>
        </div>
        <div style="background:#f9fafb;padding:16px 24px;border:1px solid #e5e7eb;border-top:none">
            <div style="display:flex;gap:24px">
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:12px 20px;text-align:center">
                    <div style="font-size:24px;font-weight:700;color:#dc2626">${decreased.length}</div>
                    <div style="font-size:12px;color:#6b7280">Bajaron precio</div>
                </div>
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:12px 20px;text-align:center">
                    <div style="font-size:24px;font-weight:700;color:#16a34a">${increased.length}</div>
                    <div style="font-size:12px;color:#6b7280">Subieron precio</div>
                </div>
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:12px 20px;text-align:center">
                    <div style="font-size:24px;font-weight:700;color:#6b7280">${updated - increased.length - decreased.length}</div>
                    <div style="font-size:12px;color:#6b7280">Sin cambio neto</div>
                </div>
            </div>
        </div>
        <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            ${decreasedSection}
            ${increasedSection}
            <p style="margin-top:32px;font-size:12px;color:#9ca3af">
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

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
    });

    const date = new Date().toLocaleDateString('es-CO', {
        timeZone: 'America/Bogota',
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const subject = decreased.length > 0
        ? `⚠️ ADMA Precios x Mayor — ${decreased.length} bajaron de rotación · ${new Date().toLocaleDateString('es-CO')}`
        : `✅ ADMA Precios x Mayor — ${updated} actualizados · ${new Date().toLocaleDateString('es-CO')}`;

    await transporter.sendMail({
        from: `"ADMA Inventario" <${gmailUser}>`,
        to: gmailUser,
        subject,
        html: buildEmailHtml(updated, increased, decreased, date),
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
