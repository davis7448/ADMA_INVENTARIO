
"use client";

import { useState, useTransition, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from './ui/input';
import type { Location } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { addLocationAction, updateLocationAction } from '@/app/actions/locations';
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

interface LocationManagementProps {
    initialLocations: Location[];
    loading: boolean;
    onLocationsUpdate: () => void;
}

const AddLocationSchema = z.object({
    name: z.string().min(1, 'El nombre debe tener al menos 1 caracter.'),
});
type AddLocationValues = z.infer<typeof AddLocationSchema>;

export function LocationManagement({ initialLocations, loading, onLocationsUpdate }: LocationManagementProps) {
    const [locations, setLocations] = useState<Location[]>(initialLocations);
    const [isSaving, startTransition] = useTransition();
    const { toast } = useToast();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    useEffect(() => {
        setLocations(initialLocations);
    }, [initialLocations]);
    
    const form = useForm<AddLocationValues>({
        resolver: zodResolver(AddLocationSchema),
        defaultValues: {
            name: '',
        },
    });

    const handleNameChange = (id: string, value: string) => {
        setLocations(prev => prev.map(loc => loc.id === id ? { ...loc, name: value } : loc));
    };
    
    const handleUpdateName = (id: string, name: string) => {
        if (!name.trim()) {
            toast({ title: 'Error', description: 'El nombre no puede estar vacío.', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const result = await updateLocationAction(id, name);
            if (result.success) {
                toast({ title: '¡Éxito!', description: result.message });
                onLocationsUpdate();
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        });
    };

    const handleAddLocation = async (values: AddLocationValues) => {
        startTransition(async () => {
            const result = await addLocationAction(values.name);
            if (result.success) {
                toast({ title: '¡Éxito!', description: 'Ubicación creada con éxito.' });
                setIsAddDialogOpen(false);
                onLocationsUpdate();
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
                    <CardTitle>Gestión de Ubicaciones</CardTitle>
                    <CardDescription>
                        Crea y renombra las ubicaciones de almacenamiento en tus bodegas.
                    </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Crear Ubicación</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nueva Ubicación</DialogTitle>
                            <DialogDescription>
                               Define el nombre para la nueva ubicación (Ej: Estante A-1).
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAddLocation)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre de la Ubicación</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Estante A-1" {...field} />
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
                    ) : locations.map((location) => (
                        <div key={location.id} className="flex items-center justify-between gap-4 p-2 border rounded-md">
                            <div className="flex-1">
                                <Input
                                    value={location.name}
                                    onChange={(e) => handleNameChange(location.id, e.target.value)}
                                    className="text-base"
                                    disabled={isSaving}
                                />
                                <p className="text-xs text-muted-foreground mt-1 ml-1">ID: <span className="font-mono">{location.id}</span></p>
                            </div>
                            <Button 
                                size="sm" 
                                onClick={() => handleUpdateName(location.id, location.name)}
                                disabled={isSaving || initialLocations.find(loc => loc.id === location.id)?.name === location.name}
                            >
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </Button>
                        </div>
                    ))}
                     {locations.length === 0 && !loading && (
                        <p className="text-center text-muted-foreground py-4">No hay ubicaciones creadas.</p>
                     )}
                </div>
            </CardContent>
        </Card>
    );
}
