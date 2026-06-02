import * as XLSX from 'xlsx';
import { getApp } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import type { SyncPriceChange } from '@/app/actions/products';

const STORAGE_BUCKET = 'studio-9748962172-82b35.firebasestorage.app';

export async function uploadWholesaleReportExcel(
    increased: SyncPriceChange[],
    decreased: SyncPriceChange[],
    dateLabel: string
): Promise<string> {
    await getApp();

    const toRow = (c: SyncPriceChange, dir: 'up' | 'down') => ({
        'Tipo':            dir === 'up' ? '↑ Subió' : '↓ Bajó',
        'Producto':        c.product,
        'SKU':             c.sku,
        'Rotación':        c.category,
        'Ventas 30d':      c.sales,
        'Margen %':        c.marginPct,
        'Costo':           Math.round(c.cost),
        'Precio Anterior': Math.round(c.oldPrice),
        'Precio Nuevo':    Math.round(c.newPrice),
        'Diferencia':      Math.round(c.newPrice - c.oldPrice),
    });

    const rows = [
        ...decreased.map(c => toRow(c, 'down')),
        ...increased.map(c => toRow(c, 'up')),
    ];

    const ws = XLSX.utils.json_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
        { wch: 10 }, { wch: 42 }, { wch: 14 }, { wch: 14 },
        { wch: 10 }, { wch: 9 },  { wch: 12 }, { wch: 16 },
        { wch: 13 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cambios');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const slug = dateLabel.replace(/\//g, '-');
    const filename = `reportes/precio-x-mayor-${slug}.xlsx`;

    const bucket = getStorage().bucket(STORAGE_BUCKET);
    const file = bucket.file(filename);

    await file.save(buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        metadata: { cacheControl: 'no-cache' },
    });

    const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return signedUrl;
}
