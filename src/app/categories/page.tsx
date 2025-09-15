
import { getCategories } from '@/lib/api';
import type { Category } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { CategoriesContent } from '@/components/categories-content';

export default async function CategoriesPage() {
    const categories: Category[] = await getCategories();

    return (
      <AuthProviderWrapper allowedRoles={['admin', 'commercial']}>
        <CategoriesContent initialCategories={categories} />
      </AuthProviderWrapper>
    );
}
