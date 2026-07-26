import { NextRequest, NextResponse } from 'next/server';
import { fetchVenndeloOrders } from '@/lib/venndelo';
import { importPlatformSales } from '@/lib/platform-sales';
import { loadCrmConfig } from '@/lib/client-volume';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Cron diario: trae las órdenes de Venndelo de los últimos N días (default 30)
// y las importa con el motor existente. Protegido con CRON_SECRET.
export async function GET(request: NextRequest) {
    const secret = request.nextUrl.searchParams.get('secret') || request.headers.get('authorization')?.replace('Bearer ', '');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 });
    }

    const days = Number(request.nextUrl.searchParams.get('days')) || 30;

    try {
        const rows = await fetchVenndeloOrders(days);
        if (rows.length === 0) {
            return NextResponse.json({ success: true, message: 'Sin órdenes en la ventana', filas: 0 });
        }
        const config = await loadCrmConfig();
        const result = await importPlatformSales('VENNDELO', rows, (config as any).reactivationDays || 45, {
            bodega: 'INGENIO', pais: 'COLOMBIA',
        });
        return NextResponse.json({
            success: true,
            days,
            filas: rows.length,
            nuevas: result.nuevas,
            actualizadas: result.actualizadas,
            entregadas: result.entregadas,
            atribuidas: result.atribuidas,
            skusVinculados: result.skusVinculados,
            mesesAbiertos: result.mesesAbiertos,
        });
    } catch (error) {
        console.error('Error en cron venndelo-sync:', error);
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Error' }, { status: 500 });
    }
}
