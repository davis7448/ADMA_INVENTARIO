
import { getProducts, getInventoryMovements } from '@/lib/api';
import type { Product } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { StockAlertsContent } from '@/components/stock-alerts-content';
import { subDays } from 'date-fns';

export default async function StockAlertsPage() {
    const [products, allMovements] = await Promise.all([
        getProducts(),
        getInventoryMovements(),
    ]);

    const sevenDaysAgo = subDays(new Date(), 7);

    // Filter movements for sales in the last 7 days
    const recentSaleMovements = allMovements.filter(
        (m) => m.type === 'Salida' && new Date(m.date) >= sevenDaysAgo
    );

    // Calculate sales per product/variant SKU
    const salesBySku: Record<string, number> = {};
    for (const movement of recentSaleMovements) {
        // This is a simplification; a real scenario would need to find the SKU from movement notes
        // For now, we assume we can find the product and determine the SKU
        const product = products.find(p => p.id === movement.productId);
        if (product) {
            // This is still not perfect as we don't know the exact variant from the movement
            // We'll increment sales for all variants for simplicity in this example
             if (product.productType === 'variable' && product.variants) {
                for (const variant of product.variants) {
                    salesBySku[variant.sku] = (salesBySku[variant.sku] || 0) + movement.quantity;
                }
            } else if (product.sku) {
                 salesBySku[product.sku] = (salesBySku[product.sku] || 0) + movement.quantity;
            }
        }
    }

    return (
      <AuthProviderWrapper allowedRoles={['admin', 'commercial']}>
        <StockAlertsContent initialProducts={products} salesBySku={salesBySku} />
      </AuthProviderWrapper>
    );
}
