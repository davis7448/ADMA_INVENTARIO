
"use client";

import { useState } from 'react';
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
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface CategoriesContentProps {
    initialCategories: Category[];
}

export function CategoriesContent({ initialCategories }: CategoriesContentProps) {
    const [categories, setCategories] = useState<Category[]>(initialCategories);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

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
              <h1 className="text-3xl font-bold font-headline tracking-tight">Categorías</h1>
              <p className="text-muted-foreground">Gestiona las categorías de tus productos.</p>
            </div>
            {canEdit && <AddCategoryForm onCategoryAdded={refreshCategories} />}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Todas las Categorías</CardTitle>
              <CardDescription>Una lista de todas las categorías de productos.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
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
                            <TableCell className="font-medium">
                              <div>{category.name}</div>
                              <Badge variant="secondary" className="mt-1 font-mono">{category.id}</Badge>
                            </TableCell>
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
