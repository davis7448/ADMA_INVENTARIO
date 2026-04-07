
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
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { ExternalWarehouseColumnConfigDialog } from './external-warehouse-column-config-dialog';

interface WarehouseManagementProps {
    initialWarehouses: Warehouse[];
    loading: boolean;
    onWarehousesUpdate: () => void;
}

const AddWarehouseSchema = z.object({
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
    type: z.enum(['internal', 'external']),
    externalProvider: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'external' && (!data.externalProvider || data.externalProvider.trim().length === 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El nombre del operador es requerido.', path: ['externalProvider'] });
    }
});
type AddWarehouseValues = z.infer<typeof AddWarehouseSchema>;

const ITEMS_PER_PAGE = 5;

export function WarehouseManagement({ initialWarehouses, loading, onWarehousesUpdate }: WarehouseManagementProps) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses);
    const [isSaving, startTransition] = useTransition();
    const { toast } = useToast();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [configWarehouse, setConfigWarehouse] = useState<Warehouse | null>(null);

    useEffect(() => {
        setWarehouses(initialWarehouses);
    }, [initialWarehouses]);

    const form = useForm<AddWarehouseValues>({
        resolver: zodResolver(AddWarehouseSchema),
        defaultValues: { name: '', type: 'internal', externalProvider: '' },
    });

    const warehouseType = form.watch('type');

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
            const result = await addWarehouseAction(
                values.name,
                values.type,
                values.type === 'external' ? values.externalProvider : undefined
            );
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
        <>
        <Card>
            <CardHeader className="flex flex-row justify-between items-start">
                <div>
                    <CardTitle>Gestión de Bodegas</CardTitle>
                    <CardDescription>
                        Crea y renombra las bodegas de tu operación.
                    </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={open => { setIsAddDialogOpen(open); if (!open) form.reset(); }}>
                    <DialogTrigger asChild>
                        <Button>Crear Bodega</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nueva Bodega</DialogTitle>
                            <DialogDescription>
                               Define el nombre y tipo de la nueva bodega.
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
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tipo de Bodega</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    className="flex gap-6"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <RadioGroupItem value="internal" id="type-internal" />
                                                        <Label htmlFor="type-internal">Interna (propia)</Label>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <RadioGroupItem value="external" id="type-external" />
                                                        <Label htmlFor="type-external">Externa (tercero)</Label>
                                                    </div>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {warehouseType === 'external' && (
                                    <FormField
                                        control={form.control}
                                        name="externalProvider"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nombre del Operador / 3PL</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ej: Coordinadora, Efecty Fulfillment..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
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
                    ) : paginatedWarehouses.map((warehouse) => {
                        const isExternal = warehouse.type === 'external';
                        const isDefault = warehouse.id === 'wh-bog';
                        return (
                        <div key={warehouse.id} className="flex items-center justify-between gap-4 p-2 border rounded-md">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={isExternal ? 'secondary' : 'outline'} className="text-xs">
                                        {isExternal ? 'Externa' : 'Interna'}
                                    </Badge>
                                    {isExternal && warehouse.externalProvider && (
                                        <span className="text-xs text-muted-foreground">{warehouse.externalProvider}</span>
                                    )}
                                </div>
                                <Input
                                    value={warehouse.name}
                                    onChange={(e) => handleNameChange(warehouse.id, e.target.value)}
                                    className="text-base"
                                    disabled={isSaving || isDefault}
                                />
                                <p className="text-xs text-muted-foreground mt-1 ml-1">ID: <span className="font-mono">{warehouse.id}</span></p>
                            </div>
                            <div className="flex gap-2 items-center">
                                {isExternal && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setConfigWarehouse(warehouse)}
                                        title="Configurar columnas del Excel"
                                    >
                                        <Settings2 className="h-4 w-4 mr-1" />
                                        Columnas
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    onClick={() => handleUpdateName(warehouse.id, warehouse.name)}
                                    disabled={isSaving || initialWarehouses.find(wh => wh.id === warehouse.id)?.name === warehouse.name || isDefault}
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar'}
                                </Button>
                            </div>
                        </div>
                        );
                    })}
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

        {configWarehouse && (
            <ExternalWarehouseColumnConfigDialog
                warehouse={configWarehouse}
                open={!!configWarehouse}
                onClose={() => setConfigWarehouse(null)}
                onSaved={() => { setConfigWarehouse(null); onWarehousesUpdate(); }}
            />
        )}
        </>
    );
}
