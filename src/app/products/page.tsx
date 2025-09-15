
import { getProducts, getSuppliersByIds, getCategoriesByIds } from '@/lib/api';
import type { Product } from '@/lib/types';
import { ProductsContent } from '@/components/products-content';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';

export default async function ProductsPage() {
    const products: Product[] = await getProducts();
    const uniqueVendorIds = [...new Set(products.map(p => p.vendorId))];
    const uniqueCategoryIds = [...new Set(products.map(p => p.categoryId))];

    const [supplierNames, categoryNames] = await Promise.all([
        getSuppliersByIds(uniqueVendorIds),
        getCategoriesByIds(uniqueCategoryIds)
    ]);

    return (
      <AuthProviderWrapper allowedRoles={['admin', 'commercial']}>
        <ProductsContent 
          initialProducts={products}
          initialSupplierNames={supplierNames}
          initialCategoryNames={categoryNames}
        />
      </AuthProviderWrapper>
    );
}
