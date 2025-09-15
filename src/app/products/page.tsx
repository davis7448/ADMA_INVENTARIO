

import { getProducts, getSuppliersByIds, getCategoriesByIds, getInventoryMovements, getRotationCategories } from '@/lib/api';
import type { Product, InventoryMovement, RotationCategory } from '@/lib/types';
import { ProductsContent } from '@/components/products-content';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { subDays } from 'date-fns';

export default async function ProductsPage() {
    const products: Product[] = await getProducts();
    const uniqueVendorIds = [...new Set(products.map(p => p.vendorId))];
    const uniqueCategoryIds = [...new Set(products.map(p => p.categoryId))];
    
    const sevenDaysAgo = subDays(new Date(), 7);

    const [supplierNames, categoryNames, allMovements, rotationCategories] = await Promise.all([
        getSuppliersByIds(uniqueVendorIds),
        getCategoriesByIds(uniqueCategoryIds),
        getInventoryMovements(),
        getRotationCategories(),
    ]);

    const recentSaleMovements = allMovements.filter(
        (m) => m.type === 'Salida' && new Date(m.date) >= sevenDaysAgo
    );

    const salesByProduct: Record<string, number> = {};
    for (const movement of recentSaleMovements) {
        salesByProduct[movement.productId] = (salesByProduct[movement.productId] || 0) + movement.quantity;
    }

    const sortedRotationCategories = [...rotationCategories].sort((a,b) => b.salesThreshold - a.salesThreshold);

    const getRotationCategoryName = (productId: string): string => {
        const sales = salesByProduct[productId] || 0;
        for (const category of sortedRotationCategories) {
            if (sales >= category.salesThreshold) {
                return category.name;
            }
        }
        return 'Inactivo';
    }

    const productsWithRotation = products.map(product => ({
        ...product,
        rotationCategoryName: getRotationCategoryName(product.id),
    }));


    return (
      <AuthProviderWrapper allowedRoles={['admin', 'commercial']}>
        <ProductsContent 
          initialProducts={productsWithRotation}
          initialSupplierNames={supplierNames}
          initialCategoryNames={categoryNames}
        />
      </AuthProviderWrapper>
    );
}
