
"use client";

import { useState, useTransition, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from './ui/input';
import type { Warehouse } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { addWarehouseAction, updateWarehouseAction } from '@/app/actions/warehouses';
import { Skeleton } from './ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WarehouseManagementProps {
    initialWarehouses: Warehouse[];
    loading: boolean;
    onWarehousesUpdate: () => void;
}

const AddWarehouseSchema = z.object({
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});
type AddWarehouseValues = z.infer<typeof AddWarehouseSchema>;

const ITEMS_PER_PAGE = 5;

export function WarehouseManagement({ initialWarehouses, loading, onWarehousesUpdate }: WarehouseManagementProps) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
    const [isSaving, startTransition] = useTransition();
    const { toast } = useToast();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setWarehouses(initialWarehouses);
    }, [initialWarehouses]);
    
    const form = useForm<AddWarehouseValues>({
        resolver: zodResolver(AddWarehouseSchema),
        defaultValues: {
            name: '',
        },
    });

    const totalPages = Math.ceil(warehouses.length / ITEMS_PER_PAGE);
    const paginatedWarehouses = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return warehouses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [warehouses, currentPage]);

    const handleNameChange = (id: string, value: string) => {
        setWarehouses(prev => prev.map(wh => wh.id === id ? { ...wh, name: value } : wh));
    };
    
    const handleUpdateName = (id: string, name: string) => {
        if (!name.trim()) {
            toast({ title: 'Error', description: 'El nombre no puede estar vacío.', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const result = await updateWarehouseAction(id, name);
            if (result.success) {
                toast({ title: '¡Éxito!', description: result.message });
                onWarehousesUpdate();
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        });
    };

    const handleAddWarehouse = async (values: AddWarehouseValues) => {
        startTransition(async () => {
            const result = await addWarehouseAction(values.name);
            if (result.success) {
                toast({ title: '¡Éxito!', description: 'Bodega creada con éxito.' });
                setIsAddDialogOpen(false);
                onWarehousesUpdate();
                form.reset();
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-start">
                <div>
                    <CardTitle>Gestión de Bodegas</CardTitle>
                    <CardDescription>
                        Crea y renombra las bodegas de tu operación.
                    </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Crear Bodega</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nueva Bodega</DialogTitle>
                            <DialogDescription>
                               Define el nombre para la nueva bodega. El ID se generará automáticamente.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAddWarehouse)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre de la Bodega</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Bodega Cali" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary">Cancelar</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={isSaving}>{isSaving ? 'Creando...' : 'Crear'}</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4">
                    {loading ? (
                        Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
                    ) : paginatedWarehouses.map((warehouse) => (
                        <div key={warehouse.id} className="flex items-center justify-between gap-4 p-2 border rounded-md">
                            <div className="flex-1">
                                <Input
                                    value={warehouse.name}
                                    onChange={(e) => handleNameChange(warehouse.id, e.target.value)}
                                    className="text-base"
                                    disabled={isSaving || warehouse.id === 'wh-bog'}
                                />
                                <p className="text-xs text-muted-foreground mt-1 ml-1">ID: <span className="font-mono">{warehouse.id}</span></p>
                            </div>
                            <Button 
                                size="sm" 
                                onClick={() => handleUpdateName(warehouse.id, warehouse.name)}
                                disabled={isSaving || initialWarehouses.find(wh => wh.id === warehouse.id)?.name === warehouse.name || warehouse.id === 'wh-bog'}
                            >
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    ))}
                     {warehouses.length === 0 && !loading && (
                        <p className="text-center text-muted-foreground py-4">No hay bodegas creadas.</p>
                     )}
                </div>
            </CardContent>
            {totalPages > 1 && (
                <CardFooter className="flex items-center justify-end space-x-2 pt-4 border-t">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                    </Button>
                    <span className="text-sm font-medium">
                        Página {currentPage} de {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Siguiente
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
