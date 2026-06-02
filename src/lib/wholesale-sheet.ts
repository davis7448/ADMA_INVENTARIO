import { getApp } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import type { SyncPriceChange } from '@/app/actions/products';

const STORAGE_BUCKET = 'studio-9748962172-82b35.firebasestorage.app';

export async function uploadWholesaleReportCsv(
    increased: SyncPriceChange[],
    decreased: SyncPriceChange[],
    dateLabel: string
): Promise<string> {
    await getApp();

    const header = 'Tipo,Producto,SKU,Rotacion,Ventas 30d,Margen %,Costo,Precio Anterior,Precio Nuevo,Diferencia\n';

    const toRow = (c: SyncPriceChange, dir: 'up' | 'down') => [
        dir === 'up' ? 'Subio' : 'Bajo',
        `"${c.product.replace(/"/g, '""')}"`,
        c.sku,
        c.category,
        c.sales,
        `${c.marginPct}%`,
        Math.round(c.cost),
        Math.round(c.oldPrice),
        Math.round(c.newPrice),
        Math.round(c.newPrice - c.oldPrice),
    ].join(',');

    const csv = header
        + decreased.map(c => toRow(c, 'down')).join('\n')
        + (decreased.length && increased.length ? '\n' : '')
        + increased.map(c => toRow(c, 'up')).join('\n');

    const slug = dateLabel.replace(/\//g, '-');
    const filename = `reportes/precio-x-mayor-${slug}.csv`;

    const bucket = getStorage().bucket(STORAGE_BUCKET);
    const file = bucket.file(filename);

    await file.save(csv, {
        contentType: 'text/csv; charset=utf-8',
        metadata: { cacheControl: 'no-cache' },
    });

    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return signedUrl;
}
