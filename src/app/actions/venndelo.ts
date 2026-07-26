"use server";

import { fetchVenndeloOrders } from '@/lib/venndelo';
import { importPlatformSales } from '@/lib/platform-sales';
import { loadCrmConfig } from '@/lib/client-volume';

// Sincroniza Venndelo bajo demanda (botón en la página). Mismo flujo que el cron.
export async function syncVenndeloAction(days: number = 30): Promise<{ success: boolean; resumen?: any; error?: string }> {
    try {
        const rows = await fetchVenndeloOrders(days);
        if (rows.length === 0) return { success: true, resumen: { filas: 0, mensaje: 'Sin órdenes en la ventana' } };
        const config = await loadCrmConfig();
        const result = await importPlatformSales('VENNDELO', rows, (config as any).reactivationDays || 45, {
            bodega: 'INGENIO', pais: 'COLOMBIA',
        });
        return { success: true, resumen: { filas: rows.length, ...result } };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
}
