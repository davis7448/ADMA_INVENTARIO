
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
import { getRotationCategories } from '@/lib/api';
import type { RotationCategory } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { AddRotationCategoryForm } from './add-rotation-category-form';

interface SettingsContentProps {
    initialRotationCategories: RotationCategory[];
}

export function SettingsContent({ initialRotationCategories }: SettingsContentProps) {
    const [rotationCategories, setRotationCategories] = useState<RotationCategory[]>(initialRotationCategories);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    const refreshRotationCategories = async () => {
        setLoading(true);
        const fetchedCategories = await getRotationCategories();
        setRotationCategories(fetchedCategories);
        setLoading(false);
    }
    
    const canEdit = user?.role === 'admin';

    return (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Configuración</h1>
              <p className="text-muted-foreground">Gestiona los parámetros y clasificaciones del sistema.</p>
            </div>
          </div>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                    <CardTitle>Clasificación de Rotación de Productos</CardTitle>
                    <CardDescription>Define las categorías para clasificar los productos según su rotación.</CardDescription>
                </div>
                {canEdit && <AddRotationCategoryForm onCategoryAdded={refreshRotationCategories} />}
              </div>
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
                     Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-80" /></TableCell>
                        </TableRow>
                     ))
                  ) : (
                    rotationCategories.map((category) => (
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
