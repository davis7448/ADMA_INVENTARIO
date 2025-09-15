
"use client";

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { getRotationCategories, updateRotationCategories } from '@/lib/api';
import type { RotationCategory } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';


interface SettingsContentProps {
    initialRotationCategories: RotationCategory[];
}

export function SettingsContent({ initialRotationCategories }: SettingsContentProps) {
    const [rotationCategories, setRotationCategories] = useState<RotationCategory[]>(initialRotationCategories);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();

    const handleThresholdChange = (id: string, value: string) => {
        const numericValue = value === '' ? 0 : parseInt(value, 10);
        if (!isNaN(numericValue)) {
            setRotationCategories(prev =>
                prev.map(cat => cat.id === id ? { ...cat, salesThreshold: numericValue } : cat)
            );
        }
    };
    
    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            await updateRotationCategories(rotationCategories);
            toast({
                title: '¡Éxito!',
                description: 'Los umbrales de rotación se han guardado correctamente.',
            });
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
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
                <CardTitle>Clasificación de Rotación de Productos</CardTitle>
                <CardDescription>
                    Define la cantidad mínima de unidades vendidas en los últimos 7 días
                    para que un producto pertenezca a una categoría de rotación.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-4 w-64" />
                                </div>
                                <Skeleton className="h-10 w-24" />
                            </div>
                        ))
                    ) : (
                        rotationCategories.map((category) => (
                            <div key={category.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                                <div className="mb-2 sm:mb-0">
                                    <Label htmlFor={`threshold-${category.id}`} className="text-base font-semibold">{category.name}</Label>
                                    <p className="text-sm text-muted-foreground">{category.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                     <Input
                                        id={`threshold-${category.id}`}
                                        type="number"
                                        value={category.salesThreshold}
                                        onChange={(e) => handleThresholdChange(category.id, e.target.value)}
                                        className="w-28 text-right"
                                        disabled={!canEdit || isSaving}
                                        min="0"
                                    />
                                    <span className="text-sm text-muted-foreground">unidades</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
            {canEdit && (
                 <CardFooter className="border-t px-6 py-4">
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </CardFooter>
            )}
          </Card>
        </div>
    )
}
