
"use client";

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCategories } from '@/lib/api';
import type { Category } from '@/lib/types';
import { AddCategoryForm } from '@/components/add-category-form';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

function CategoriesContent() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
      async function fetchCategories() {
        setLoading(true);
        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories);
        setLoading(false);
      }
      fetchCategories();
    }, []);

    const refreshCategories = async () => {
        setLoading(true);
        const fetchedCategories = await getCategories();
        setCategories(fetchedCategories);
        setLoading(false);
    }
    
    const canEdit = user?.role === 'admin';

    return (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Categories</h1>
              <p className="text-muted-foreground">Manage your product categories.</p>
            </div>
            {canEdit && <AddCategoryForm onCategoryAdded={refreshCategories} />}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>All Categories</CardTitle>
              <CardDescription>A list of all product categories.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                     Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-80" /></TableCell>
                        </TableRow>
                     ))
                  ) : (
                    categories.map((category) => (
                        <TableRow key={category.id}>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell>{category.description}</TableCell>
                        </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
    )
}

export default function CategoriesPage() {
    return (
      <AuthProviderWrapper allowedRoles={['admin', 'commercial']}>
        <CategoriesContent />
      </AuthProviderWrapper>
    );
}

