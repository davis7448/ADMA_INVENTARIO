
import { getCategories } from '@/lib/api';
import type { Category } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { CategoriesContent } from '@/components/categories-content';
import { Suspense } from 'react';

export default async function CategoriesPage() {
    let categories: Category[] = [];
    try {
        categories = await getCategories();
    } catch (error) {
        console.warn('Failed to fetch categories during build:', error);
        // Return empty array for build time, data will be loaded client-side
        categories = [];
    }

    return (
      <Suspense>
        <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
          <CategoriesContent initialCategories={categories} />
        </AuthProviderWrapper>
      </Suspense>
    );
}
