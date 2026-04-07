

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
import { Button } from '@/components/ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { getRotationCategories, updateRotationCategories, getUsers, getWarehouses, getLocations } from '@/lib/api';
import type { RotationCategory, User, EntryReason, Warehouse, Location } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { UserManagement } from './user-management';
import { ProfileManagement } from './profile-management';
import { EntryReasonsManagement } from './entry-reasons-management';
import { WarehouseManagement } from './warehouse-management';
import { LocationManagement } from './location-management';
import { reconcileCancelledExceptions } from '@/app/actions/data-reconciliation';

interface SettingsContentProps {
    initialRotationCategories: RotationCategory[];
    initialUsers: User[];
    initialEntryReasons: EntryReason[];
    initialWarehouses: Warehouse[];
    initialLocations: Location[];
}

export function SettingsContent({ initialRotationCategories, initialUsers, initialEntryReasons, initialWarehouses, initialLocations }: SettingsContentProps) {
    const [rotationCategories, setRotationCategories] = useState<RotationCategory[]>(initialRotationCategories);
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
    const [locations, setLocations] = useState<Location[]>(initialLocations);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isReconciling, setIsReconciling] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();

    const refreshUsers = async () => {
        setLoading(true);
        try {
            const fetchedUsers = await getUsers();
            setUsers(fetchedUsers);
        } catch (error) {
            console.warn("Could not fetch users. This is expected in the prototype environment if admin SDK is not configured.");
        }
        setLoading(false);
    }
    
    const refreshWarehouses = async () => {
        setLoading(true);
        const fetchedWarehouses = await getWarehouses();
        setWarehouses(fetchedWarehouses);
        setLoading(false);
    };

    const refreshLocations = async () => {
        setLoading(true);
        const fetchedLocations = await getLocations();
        setLocations(fetchedLocations);
        setLoading(false);
    };

    useEffect(() => {
        setUsers(initialUsers);
    }, [initialUsers]);

    useEffect(() => {
        setWarehouses(initialWarehouses);
    }, [initialWarehouses]);
    
    useEffect(() => {
        setLocations(initialLocations);
    }, [initialLocations]);


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

    const handleReconcileData = async () => {
        setIsReconciling(true);
        try {
            const result = await reconcileCancelledExceptions();
            if (result.errors.length > 0) {
                toast({
                    title: 'Conciliación completada con errores',
                    description: `Se conciliaron ${result.reconciled} órdenes. Errores: ${result.errors.join(', ')}`,
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: '¡Éxito!',
                    description: `Se conciliaron ${result.reconciled} órdenes correctamente.`,
                });
            }
        } catch (error) {
            console.error(error);
            toast({
                title: 'Error',
                description: 'No se pudo completar la conciliación. Inténtalo de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setIsReconciling(false);
        }
    }

    const isAdmin = user?.role === 'admin';
    const canManageSettings = user?.role === 'admin' || user?.role === 'plataformas';

    return (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Configuración</h1>
              <p className="text-muted-foreground">Gestiona los parámetros y usuarios del sistema.</p>
            </div>
          </div>
          
          <ProfileManagement />

          {isAdmin && (
            <UserManagement initialUsers={users} onUsersUpdate={refreshUsers} loading={loading} warehouses={warehouses} />
          )}

          {isAdmin && (
            <WarehouseManagement initialWarehouses={warehouses} onWarehousesUpdate={refreshWarehouses} loading={loading} />
          )}

          {isAdmin && (
            <LocationManagement initialLocations={locations} onLocationsUpdate={refreshLocations} loading={loading} />
          )}
          
          {canManageSettings && (
             <EntryReasonsManagement initialEntryReasons={initialEntryReasons} />
          )}

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
                    {loading && (isAdmin || user?.role === 'plataformas') ? (
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
                                        disabled={!canManageSettings || isSaving}
                                        min="0"
                                    />
                                    <span className="text-sm text-muted-foreground">unidades</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
            {canManageSettings && (
                 <CardFooter className="border-t px-6 py-4">
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </CardFooter>
            )}
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader>
                  <CardTitle>Conciliación de Datos</CardTitle>
                  <CardDescription>
                      Corrige inconsistencias entre órdenes de despacho y movimientos de inventario.
                      Útil cuando se eliminan movimientos manualmente y los datos quedan desactualizados.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <p className="text-sm text-muted-foreground">
                      Esta acción revisará las órdenes con anulaciones y eliminará las excepciones canceladas
                      que no tengan movimientos de inventario correspondientes.
                  </p>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                  <Button onClick={handleReconcileData} disabled={isReconciling}>
                      {isReconciling ? 'Conciliando...' : 'Conciliar Datos'}
                  </Button>
              </CardFooter>
            </Card>
          )}
        </div>
    )
}
