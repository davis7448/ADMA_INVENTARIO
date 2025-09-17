

import { getProducts, getSuppliersByIds, getCategoriesByIds, getInventoryMovements, getRotationCategories } from '@/lib/api';
import type { Product, InventoryMovement, RotationCategory } from '@/lib/types';
import { ProductsContent } from '@/components/products-content';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';

export const revalidate = 0;

export default async function ProductsPage() {
    const [products, supplierIdMap, categoryIdMap, allMovements, rotationCategories] = await Promise.all([
        getProducts(),
        getSuppliersByIds([]), // Fetch logic is now inside component
        getCategoriesByIds([]), // Fetch logic is now inside component
        getInventoryMovements(7), // Fetch only last 7 days of movements
        getRotationCategories(),
    ]);

    const salesByProduct: Record<string, number> = {};
    for (const movement of allMovements) {
        if (movement.type === 'Salida') {
            salesByProduct[movement.productId] = (salesByProduct[movement.productId] || 0) + movement.quantity;
        }
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

    // We pass empty maps because the content component will fetch them based on the initial products
    const uniqueVendorIds = [...new Set(productsWithRotation.map(p => p.vendorId))];
    const uniqueCategoryIds = [...new Set(productsWithRotation.map(p => p.categoryId))];
    
    const [supplierNames, categoryNames] = await Promise.all([
        getSuppliersByIds(uniqueVendorIds),
        getCategoriesByIds(uniqueCategoryIds),
    ]);


    return (
      <AuthProviderWrapper allowedRoles={['admin', 'commercial', 'plataformas']}>
        <ProductsContent 
          initialProducts={productsWithRotation}
          initialSupplierNames={supplierNames}
          initialCategoryNames={categoryNames}
          allRotationCategories={rotationCategories}
        />
      </AuthProviderWrapper>
    );
}
