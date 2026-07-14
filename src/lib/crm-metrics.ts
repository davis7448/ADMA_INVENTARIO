import { format, startOfDay, startOfMonth } from 'date-fns';
import type { CommercialClient, ClientStatus } from '@/types/commercial';
import { getCurrentWeekInfo } from '@/types/commercial';

// Etiquetas legibles de las etapas del pipeline (compartidas con el tablero Kanban).
export const STATUS_LABELS: Record<ClientStatus, string> = {
    finding_winner: 'Encontrando Winner',
    testing: 'Testeando',
    selling: 'Vendiendo',
    scaling: 'Escalando',
};

export const getStatusLabel = (status: string): string =>
    STATUS_LABELS[status as ClientStatus] ?? status;

export interface DateRangeFilter {
    from: Date;
    to: Date;
}

export interface CrmMetrics {
    totalClients: number;
    newThisMonth: number;
    newThisWeek: number;
    avgSales: number; // promedio de avg_sales sobre todos los clientes
    additionsInRange: number; // total de altas dentro del rango seleccionado
    additionsByDay: { date: string; count: number }[]; // serie temporal con huecos rellenos
    additionsByCommercial: { name: string; count: number }[]; // ranking desc, dentro del rango
    byStatus: { status: ClientStatus; label: string; count: number }[];
    byCategory: { name: string; count: number }[];
    byType: { name: string; count: number }[];
    byCity: { name: string; count: number }[];
}

// Normaliza created_at: puede venir como Date (ya convertido por la API), Timestamp de Firestore o undefined.
const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
        return (value as any).toDate();
    }
    const parsed = new Date(value as any);
    return isNaN(parsed.getTime()) ? null : parsed;
};

// Atribución del creador: preferimos el creador real; si no existe (clientes históricos),
// caemos al comercial asignado; y en último caso 'Sin asignar'.
const getCreatorName = (client: CommercialClient): string =>
    client.created_by_name || client.assigned_commercial_name || 'Sin asignar';

// Cuenta ocurrencias por clave y devuelve un ranking descendente.
const countBy = (
    clients: CommercialClient[],
    keyFn: (c: CommercialClient) => string | undefined,
): { name: string; count: number }[] => {
    const counts: Record<string, number> = {};
    for (const client of clients) {
        const key = keyFn(client) || 'Sin dato';
        counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
};

export function computeCrmMetrics(
    clients: CommercialClient[],
    range: DateRangeFilter,
): CrmMetrics {
    const monthStart = startOfMonth(new Date());
    const { weekStart } = getCurrentWeekInfo();

    let newThisMonth = 0;
    let newThisWeek = 0;
    let salesSum = 0;

    // Altas dentro del rango, agrupadas por día (yyyy-MM-dd) — patrón de dashboard-utils.ts.
    const additionsByDayMap: Record<string, number> = {};
    const clientsInRange: CommercialClient[] = [];

    for (const client of clients) {
        salesSum += Number(client.avg_sales) || 0;

        const createdAt = toDate(client.created_at);
        if (!createdAt) continue;

        if (createdAt >= monthStart) newThisMonth += 1;
        if (createdAt >= weekStart) newThisWeek += 1;

        if (createdAt >= startOfDay(range.from) && createdAt <= range.to) {
            const dayKey = format(createdAt, 'yyyy-MM-dd');
            additionsByDayMap[dayKey] = (additionsByDayMap[dayKey] || 0) + 1;
            clientsInRange.push(client);
        }
    }

    // Rellenar cada día del rango para que la serie no tenga huecos.
    const additionsByDay: { date: string; count: number }[] = [];
    let cursor = startOfDay(new Date(range.from));
    const end = new Date(range.to);
    while (cursor <= end) {
        const dayKey = format(cursor, 'yyyy-MM-dd');
        additionsByDay.push({ date: dayKey, count: additionsByDayMap[dayKey] || 0 });
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() + 1);
    }

    // Distribución por etapa manteniendo el orden del pipeline.
    const statusOrder: ClientStatus[] = ['finding_winner', 'testing', 'selling', 'scaling'];
    const byStatus = statusOrder.map((status) => ({
        status,
        label: STATUS_LABELS[status],
        count: clients.filter((c) => c.status === status).length,
    }));

    return {
        totalClients: clients.length,
        newThisMonth,
        newThisWeek,
        avgSales: clients.length ? salesSum / clients.length : 0,
        additionsInRange: clientsInRange.length,
        additionsByDay,
        additionsByCommercial: countBy(clientsInRange, getCreatorName),
        byStatus,
        byCategory: countBy(clients, (c) => c.category),
        byType: countBy(clients, (c) => c.type),
        byCity: countBy(clients, (c) => c.city),
    };
}
