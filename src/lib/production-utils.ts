import { format, getDate } from 'date-fns';
import type { DashboardRawData } from './dashboard-utils';
import type { DispatchOrderProduct, DispatchExceptionProduct } from './types';

export type WeekData = {
  despachado: number;
  devoluciones: number;
  averias: number;
  estimacion: number;
};

export type ProductionProductData = {
  name: string;
  despachado: number;
  devoluciones: number;
  averias: number;
  estimacion: number;
  semanas: Record<string, WeekData>;
};

export type ProductionMonthData = {
  porProducto: Record<string, ProductionProductData>;
  totales: {
    despachado: number;
    devoluciones: number;
    averias: number;
    estimacion: number;
  };
};

export type ProductionReportData = Record<string, ProductionMonthData>;

function weekOfMonth(date: Date): string {
  return `S${Math.min(Math.ceil(getDate(date) / 7), 5)}`;
}

function emptyWeekData(): WeekData {
  return { despachado: 0, devoluciones: 0, averias: 0, estimacion: 0 };
}

function getOrInit<T>(record: Record<string, T>, key: string, init: () => T): T {
  if (!record[key]) record[key] = init();
  return record[key];
}

export function computeProductionReport(
  raw: DashboardRawData,
  filters: { dateRange?: { from?: Date; to?: Date }; warehouseId?: string | null }
): ProductionReportData {
  const { ordersResult, movementsResult } = raw;
  const { warehouseId } = filters;

  const warehouseMatch = (wId?: string | null) =>
    !warehouseId || warehouseId === 'all' ||
    (warehouseId === 'wh-bog' && (wId === 'wh-bog' || wId == null)) ||
    wId === warehouseId;

  const result: ProductionReportData = {};

  // --- Dispatched units per product per month ---
  for (const order of ordersResult.orders) {
    if (!warehouseMatch(order.warehouseId)) continue;

    const date = new Date(order.date);
    const month = format(date, 'yyyy-MM');
    const week = weekOfMonth(date);

    const monthData = getOrInit(result, month, () => ({
      porProducto: {},
      totales: { despachado: 0, devoluciones: 0, averias: 0, estimacion: 0 },
    }));

    // Compute net products (same logic as dashboard-utils.ts:253-277)
    let netProducts: { productId: string; name: string; quantity: number }[] = [];
    if (order.status === 'Despachada') {
      netProducts = order.products.map((p: DispatchOrderProduct) => ({
        productId: p.productId,
        name: p.name,
        quantity: p.quantity,
      }));
    } else if (order.status === 'Parcial' && order.exceptions) {
      const exMap = new Map(
        order.exceptions.flatMap(ex => ex.products.map((p: DispatchExceptionProduct) => [p.productId, p.quantity]))
      );
      netProducts = order.products
        .map((p: DispatchOrderProduct) => ({
          productId: p.productId,
          name: p.name,
          quantity: p.quantity - (exMap.get(p.productId) || 0),
        }))
        .filter(p => p.quantity > 0);
    }

    if (order.cancelledExceptions) {
      const cancelMap = new Map(
        order.cancelledExceptions.flatMap(ex => ex.products.map((p: DispatchExceptionProduct) => [p.productId, p.quantity]))
      );
      netProducts = netProducts
        .map(p => ({ ...p, quantity: p.quantity - (cancelMap.get(p.productId) || 0) }))
        .filter(p => p.quantity > 0);
    }

    for (const p of netProducts) {
      const prod = getOrInit(monthData.porProducto, p.productId, () => ({
        name: p.name,
        despachado: 0,
        devoluciones: 0,
        averias: 0,
        estimacion: 0,
        semanas: {},
      }));
      prod.despachado += p.quantity;
      const wk = getOrInit(prod.semanas, week, emptyWeekData);
      wk.despachado += p.quantity;
    }
  }

  // --- Devoluciones and averías per product per month (from movements) ---
  for (const m of movementsResult.movements) {
    if (!warehouseMatch(m.warehouseId)) continue;

    const date = new Date(m.date);
    const month = format(date, 'yyyy-MM');
    const week = weekOfMonth(date);

    const isDevolucion =
      m.type === 'Entrada' &&
      m.notes &&
      (m.notes.toLowerCase().includes('devolución') || m.notes.toLowerCase().includes('averia'));
    const isAveria = m.type === 'Averia';

    if (!isDevolucion && !isAveria) continue;

    const monthData = getOrInit(result, month, () => ({
      porProducto: {},
      totales: { despachado: 0, devoluciones: 0, averias: 0, estimacion: 0 },
    }));

    const prod = getOrInit(monthData.porProducto, m.productId, () => ({
      name: m.productName || m.productId,
      despachado: 0,
      devoluciones: 0,
      averias: 0,
      estimacion: 0,
      semanas: {},
    }));

    const wk = getOrInit(prod.semanas, week, emptyWeekData);

    if (isDevolucion) {
      prod.devoluciones += m.quantity;
      wk.devoluciones += m.quantity;
    } else {
      prod.averias += m.quantity;
      wk.averias += m.quantity;
    }
  }

  // --- Compute estimacion = despachado + averias - devoluciones ---
  for (const monthData of Object.values(result)) {
    for (const prod of Object.values(monthData.porProducto)) {
      prod.estimacion = prod.despachado + prod.averias - prod.devoluciones;
      for (const wk of Object.values(prod.semanas)) {
        wk.estimacion = wk.despachado + wk.averias - wk.devoluciones;
      }
    }
    monthData.totales = Object.values(monthData.porProducto).reduce(
      (acc, p) => ({
        despachado: acc.despachado + p.despachado,
        devoluciones: acc.devoluciones + p.devoluciones,
        averias: acc.averias + p.averias,
        estimacion: acc.estimacion + p.estimacion,
      }),
      { despachado: 0, devoluciones: 0, averias: 0, estimacion: 0 }
    );
  }

  return result;
}
