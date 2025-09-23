
import { getCategories } from '@/lib/api';
import type { Category } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { CategoriesContent } from '@/components/categories-content';
import { Suspense } from 'react';

export default async function CategoriesPage() {
    const categories: Category[] = await getCategories();

    return (
      <Suspense>
        <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
          <CategoriesContent initialCategories={categories} />
        </AuthProviderWrapper>
      </Suspense>
    );
}
