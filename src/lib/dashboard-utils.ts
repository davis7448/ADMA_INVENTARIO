import type { DispatchOrder, InventoryMovement, Product, Category, Platform, Carrier, DashboardData, DispatchOrderProduct, DispatchExceptionProduct } from './types';
import { format, startOfDay } from 'date-fns';

export type DashboardRawData = {
  ordersResult: { orders: DispatchOrder[] };
  movementsResult: { movements: InventoryMovement[] };
  allProducts: { products: Product[] };
  allCategories: Category[];
  allPlatforms: Platform[];
  allCarriers: Carrier[];
};

export function computeDashboardData(
  raw: DashboardRawData,
  filters: { dateRange?: { from?: Date; to?: Date }; warehouseId?: string | null; platformIds: string[]; carrierIds: string[]; categoryIds: string[]; productIds: string[] }
): DashboardData {
    const { ordersResult, movementsResult, allProducts, allCategories, allPlatforms, allCarriers } = raw;
    const { from: fromDate, to: toDate } = filters.dateRange || {};
    let { warehouseId } = filters;

    // Lógica de filtrado en memoria para INGENIO
    let filteredOrders = ordersResult.orders;
    let filteredMovements = movementsResult.movements;

    const productIdsInCategory = filters.categoryIds.length > 0
      ? allProducts.products.filter(p => p.categoryId && filters.categoryIds.includes(p.categoryId)).map(p => p.id)
      : null;

    const platformNameMap = allPlatforms.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>);
    const carrierNameMap = allCarriers.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>);
    const allCarrierNames = allCarriers.map(c => c.name);

    const ordersInPeriod = filteredOrders.filter(order => {
        const platformMatch = filters.platformIds.length === 0 || filters.platformIds.includes(order.platformId);
        const carrierMatch = filters.carrierIds.length === 0 || filters.carrierIds.includes(order.carrierId);

        let productMatch = true;
        if (filters.productIds.length > 0) {
            productMatch = order.products.some(p => filters.productIds.includes(p.productId));
        } else if (productIdsInCategory) {
            productMatch = order.products.some(p => productIdsInCategory.includes(p.productId));
        }

        const warehouseMatch = !warehouseId || warehouseId === 'all' || (warehouseId === 'wh-bog' && (order.warehouseId === 'wh-bog' || order.warehouseId == null)) || order.warehouseId === warehouseId;

        return platformMatch && carrierMatch && productMatch && warehouseMatch;
    });

    const movementsInPeriod = filteredMovements.filter(m => {
        let productMatch = true;
        if (filters.productIds.length > 0) {
            productMatch = filters.productIds.includes(m.productId);
        } else if (productIdsInCategory) {
            productMatch = productIdsInCategory.includes(m.productId);
        }
        const warehouseMatch = !warehouseId || warehouseId === 'all' || (warehouseId === 'wh-bog' && (m.warehouseId === 'wh-bog' || m.warehouseId == null)) || m.warehouseId === warehouseId;
        return productMatch && warehouseMatch;
    });

    const ordersByDay: Record<string, number> = {};
    const annulledByDay: Record<string, number> = {};

    ordersInPeriod.forEach(order => {
        // order.date may be string (after server action boundary) or Date — normalize with new Date()
        const day = format(new Date(order.date), 'yyyy-MM-dd');

        let dispatchedInOrder = order.products.reduce((sum, p) => sum + p.quantity, 0);

        if (order.status === 'Parcial' && order.exceptions) {
            const exceptionsTotal = order.exceptions.reduce((sum, ex) => sum + ex.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
            dispatchedInOrder -= exceptionsTotal;
        }

        if (order.cancelledExceptions) {
            const cancelledTotal = order.cancelledExceptions.reduce((sum, ex) => sum + ex.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
            annulledByDay[day] = (annulledByDay[day] || 0) + cancelledTotal;
            dispatchedInOrder -= cancelledTotal;
        }
        ordersByDay[day] = (ordersByDay[day] || 0) + dispatchedInOrder;
    });

    const totalItemsDispatched = Object.values(ordersByDay).reduce((sum, count) => sum + count, 0);
    const totalAnnulledItems = Object.values(annulledByDay).reduce((sum, count) => sum + count, 0);

    let totalAdjustIn = 0;
    let totalAdjustOut = 0;
    const adjustInByDay: Record<string, number> = {};
    const adjustOutByDay: Record<string, number> = {};

    movementsInPeriod.forEach(m => {
        const day = format(new Date(m.date), 'yyyy-MM-dd');
        if (m.type === 'Ajuste de Entrada') {
            totalAdjustIn += m.quantity;
            adjustInByDay[day] = (adjustInByDay[day] || 0) + m.quantity;
        } else if (m.type === 'Ajuste de Salida') {
            totalAdjustOut += m.quantity;
            adjustOutByDay[day] = (adjustOutByDay[day] || 0) + m.quantity;
        }
    });

    let totalPendingUnits = 0;
    const pendingUnitsByDay: Record<string, number> = {};
    ordersInPeriod
        .filter(o => o.status === 'Pendiente' || o.status === 'Parcial')
        .forEach(order => {
            const day = format(new Date(order.date), 'yyyy-MM-dd');
            let unitsInOrder = 0;
            if (order.status === 'Pendiente') {
                unitsInOrder = order.totalItems;
            } else if (order.status === 'Parcial' && order.exceptions) {
                unitsInOrder = order.exceptions.reduce((sum, ex) => sum + ex.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
            }
            totalPendingUnits += unitsInOrder;
            pendingUnitsByDay[day] = (pendingUnitsByDay[day] || 0) + unitsInOrder;
        });

    const returnsByDay: Record<string, number> = {};
    const totalReturns = movementsInPeriod
        .filter(m => m.type === 'Entrada' && (m.notes.toLowerCase().includes('devolución') || m.notes.toLowerCase().includes('averia')))
        .reduce((sum, m) => {
            const day = format(new Date(m.date), 'yyyy-MM-dd');
            returnsByDay[day] = (returnsByDay[day] || 0) + m.quantity;
            return sum + m.quantity;
        }, 0);

    const chartData: { date: string; orders: number }[] = [];
    const pendingChartData: { date: string; orders: number }[] = [];
    const returnsChartData: { date: string; returns: number }[] = [];
    const annulledChartData: { date: string; annulled: number }[] = [];
    const adjustInChartData: { date: string; value: number }[] = [];
    const adjustOutChartData: { date: string; value: number }[] = [];

    if (fromDate && toDate) {
        let currentDate = startOfDay(new Date(fromDate));
        const endDate = new Date(toDate);
        while (currentDate <= endDate) {
            const dayKey = format(currentDate, 'yyyy-MM-dd');
            chartData.push({ date: dayKey, orders: ordersByDay[dayKey] || 0 });
            pendingChartData.push({ date: dayKey, orders: pendingUnitsByDay[dayKey] || 0 });
            returnsChartData.push({ date: dayKey, returns: returnsByDay[dayKey] || 0 });
            annulledChartData.push({ date: dayKey, annulled: annulledByDay[dayKey] || 0 });
            adjustInChartData.push({ date: dayKey, value: adjustInByDay[dayKey] || 0 });
            adjustOutChartData.push({ date: dayKey, value: adjustOutByDay[dayKey] || 0 });
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    const productInfoMap = allProducts.products.reduce((acc, product) => ({ ...acc, [product.id]: product }), {} as Record<string, Product>);
    const categoryNameMap = allCategories.reduce((acc, category) => ({ ...acc, [category.id]: category.name }), {} as Record<string, string>);

    const salesByProduct: Record<string, { total: number; variants: Record<string, number> }> = {};
    let totalItemsSold = 0;
    ordersInPeriod.forEach(order => {
        order.products.forEach((p: DispatchOrderProduct) => {
            const product = productInfoMap[p.productId];
            if (!product) return;
            if (!salesByProduct[p.productId]) {
                salesByProduct[p.productId] = { total: 0, variants: {} };
            }
            salesByProduct[p.productId].total += p.quantity;
            if (p.variantId) {
                if (!salesByProduct[p.productId].variants[p.variantId]) {
                    salesByProduct[p.productId].variants[p.variantId] = 0;
                }
                salesByProduct[p.productId].variants[p.variantId] += p.quantity;
            }
            totalItemsSold += p.quantity;
        });
    });

    // Subtract cancelled exceptions
    ordersInPeriod.forEach(order => {
        if (order.cancelledExceptions) {
            order.cancelledExceptions.forEach(ex => {
                ex.products.forEach((p: DispatchExceptionProduct) => {
                    if (salesByProduct[p.productId]) {
                        salesByProduct[p.productId].total -= p.quantity;
                        if (p.variantId && salesByProduct[p.productId].variants[p.variantId] !== undefined) {
                            salesByProduct[p.productId].variants[p.variantId] -= p.quantity;
                        }
                    }
                });
            });
        }
    });

    // Recalculate totalItemsSold as net sold
    totalItemsSold = Object.values(salesByProduct).reduce((sum, p) => sum + Math.max(0, p.total), 0);

    const productChartData = Object.entries(salesByProduct).map(([productId, salesData]) => {
        const product = productInfoMap[productId];
        return {
            id: productId,
            name: product.name,
            productType: product.productType,
            value: salesData.total,
            percentage: totalItemsSold > 0 ? (salesData.total / totalItemsSold) * 100 : 0,
            variants: product.variants?.map(v => ({ ...v, sales: salesData.variants[v.id] || 0 })) || [],
        };
    }).sort((a, b) => b.value - a.value);

    const salesByCategory: Record<string, number> = {};
    Object.entries(salesByProduct).forEach(([productId, salesData]) => {
        const product = productInfoMap[productId];
        if (product?.categoryId) {
            salesByCategory[product.categoryId] = (salesByCategory[product.categoryId] || 0) + salesData.total;
        }
    });

    const categoryChartData = Object.entries(salesByCategory).map(([categoryId, count]) => ({
        name: categoryNameMap[categoryId] || 'Unknown',
        value: count,
        percentage: totalItemsSold > 0 ? (count / totalItemsSold) * 100 : 0,
    })).sort((a, b) => b.value - a.value);

    const platformCarrierMap: { [platformName: string]: { [carrierName: string]: number } } = {};
    allPlatforms.forEach((p: Platform) => {
        platformCarrierMap[p.name] = {};
    });

    const platformOrderCount: { [platformName: string]: number } = {};
    const carrierUsageCount: { [carrierName: string]: number } = {};
    let totalProductsShipped = 0;
    const dailyDispatchSummaryData: Record<string, Record<string, Record<string, number>>> = {};
    const dailyProductDispatch: Record<string, Record<string, { name: string, quantity: number }>> = {};

    ordersInPeriod.forEach(order => {
        const platformName = platformNameMap[order.platformId] || 'Unknown Platform';
        const carrierName = carrierNameMap[order.carrierId] || 'Unknown Carrier';

        if (platformName !== 'Unknown Platform' && carrierName !== 'Unknown Carrier') {
            if (!platformCarrierMap[platformName]) {
                platformCarrierMap[platformName] = {};
            }
            platformCarrierMap[platformName][carrierName] = (platformCarrierMap[platformName][carrierName] || 0) + order.totalItems;
        }

        platformOrderCount[platformName] = (platformOrderCount[platformName] || 0) + 1;
        if(carrierName !== 'Unknown Carrier') {
            carrierUsageCount[carrierName] = (carrierUsageCount[carrierName] || 0) + order.totalItems;
        }
        totalProductsShipped += order.totalItems;
        const day = format(new Date(order.date), 'yyyy-MM-dd');
        const guideCount = order.trackingNumbers?.length || 0;
        if (guideCount > 0 && carrierName !== 'Unknown Carrier' && platformName !== 'Unknown Platform') {
            if (!dailyDispatchSummaryData[day]) dailyDispatchSummaryData[day] = {};
            if (!dailyDispatchSummaryData[day][carrierName]) dailyDispatchSummaryData[day][carrierName] = {};
            dailyDispatchSummaryData[day][carrierName][platformName] = (dailyDispatchSummaryData[day][carrierName][platformName] || 0) + guideCount;
        }

        // Calculate daily product dispatch
        if (!dailyProductDispatch[day]) dailyProductDispatch[day] = {};
        let netProducts: { productId: string, name: string, quantity: number }[] = [];
        if (order.status === 'Despachada') {
            netProducts = order.products.map(p => ({ productId: p.productId, name: p.name, quantity: p.quantity }));
        } else if (order.status === 'Parcial') {
            const exceptionMap = new Map(order.exceptions?.flatMap(ex => ex.products.map(p => [p.productId, p.quantity])) || []);
            netProducts = order.products.map(p => ({
                productId: p.productId,
                name: p.name,
                quantity: p.quantity - (exceptionMap.get(p.productId) || 0)
            })).filter(p => p.quantity > 0);
        }
        if (order.cancelledExceptions) {
            const cancelledMap = new Map(order.cancelledExceptions.flatMap(ex => ex.products.map(p => [p.productId, p.quantity])));
            netProducts = netProducts.map(p => ({
                productId: p.productId,
                name: p.name,
                quantity: p.quantity - (cancelledMap.get(p.productId) || 0)
            })).filter(p => p.quantity > 0);
        }
        netProducts.forEach((p: { productId: string; name: string; quantity: number }) => {
            if (!dailyProductDispatch[day][p.productId]) {
                dailyProductDispatch[day][p.productId] = { name: p.name, quantity: 0 };
            }
            dailyProductDispatch[day][p.productId].quantity += p.quantity;
        });
    });

    const platformCarrierChartData = Object.entries(platformCarrierMap).map(([platformName, carriers]) => {
      const chartEntry: { [key: string]: string | number } = { name: platformName };
      allCarrierNames.forEach(carrierName => {
        chartEntry[carrierName] = carriers[carrierName] || 0;
      });
      return chartEntry;
    });

    const mostUsedCarrierEntry = Object.entries(carrierUsageCount).sort((a, b) => b[1] - a[1])[0];
    const platformWithMostOrdersEntry = Object.entries(platformOrderCount).sort((a, b) => b[1] - a[1])[0];

    return {
      totalItemsDispatched: totalItemsDispatched,
      totalAnnulledItems,
      totalPendingUnits,
      totalReturns,
      totalAdjustIn,
      totalAdjustOut,
      chartData,
      pendingChartData,
      returnsChartData,
      annulledChartData,
      adjustInChartData,
      adjustOutChartData,
      productChartData,
      categoryChartData,
      platformCarrierChartData,
      allCarrierNames,
      mostUsedCarrier: {
        name: mostUsedCarrierEntry?.[0] || 'N/A',
        count: mostUsedCarrierEntry?.[1] || 0,
        percentage: totalProductsShipped > 0 ? ((mostUsedCarrierEntry?.[1] || 0) / totalProductsShipped) * 100 : 0,
      },
      platformWithMostOrders: {
        name: platformWithMostOrdersEntry?.[0] || 'N/A',
        count: platformWithMostOrdersEntry?.[1] || 0,
        percentage: ordersInPeriod.length > 0 ? ((platformWithMostOrdersEntry?.[1] || 0) / ordersInPeriod.length) * 100 : 0,
      },
      dailyDispatchSummaryData,
      dailyProductDispatch,
  };
}
