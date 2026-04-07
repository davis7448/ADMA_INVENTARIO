
"use client";

import { useState, useTransition, useEffect } from 'react';
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
import type { EntryReason } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { updateEntryReasonsAction, addEntryReasonAction } from '@/app/actions/entry-reasons';
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

interface EntryReasonsManagementProps {
    initialEntryReasons: EntryReason[];
}

const AddEntryReasonSchema = z.object({
    label: z.string().min(1, 'La etiqueta es requerida.'),
    value: z.string().min(1, 'El valor es requerido (ej: "transfer").').regex(/^[a-z_]+$/, 'El valor solo puede contener letras minúsculas y guiones bajos.'),
});

type AddEntryReasonValues = z.infer<typeof AddEntryReasonSchema>;

export function EntryReasonsManagement({ initialEntryReasons }: EntryReasonsManagementProps) {
    const [reasons, setReasons] = useState<EntryReason[]>(initialEntryReasons);
    const [isSaving, startTransition] = useTransition();
    const { toast } = useToast();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    useEffect(() => {
        setReasons(initialEntryReasons);
    }, [initialEntryReasons]);

    const form = useForm<AddEntryReasonValues>({
        resolver: zodResolver(AddEntryReasonSchema),
        defaultValues: {
            label: '',
            value: '',
        },
    });

    const handleLabelChange = (id: string, value: string) => {
        setReasons(prev =>
            prev.map(reason => reason.id === id ? { ...reason, label: value } : reason)
        );
    };

    const handleSaveChanges = async () => {
        startTransition(async () => {
            const result = await updateEntryReasonsAction(reasons);
            if (result.success) {
                toast({
                    title: '¡Éxito!',
                    description: result.message,
                });
            } else {
                toast({
                    title: 'Error',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        });
    };

    const handleAddReason = async (values: AddEntryReasonValues) => {
        startTransition(async () => {
            const result = await addEntryReasonAction(values);
            if (result.success) {
                toast({
                    title: '¡Éxito!',
                    description: 'Concepto de ingreso creado.',
                });
                setIsAddDialogOpen(false);
                // Manually add the new reason to the state to avoid a full page reload
                setReasons(prev => [...prev, {id: result.newId!, ...values}]);
                form.reset();
            } else {
                toast({
                    title: 'Error',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-start">
                <div>
                    <CardTitle>Conceptos de Ingreso de Mercancía</CardTitle>
                    <CardDescription>
                        Define los motivos que se pueden seleccionar al registrar una entrada de inventario.
                    </CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Crear Concepto</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Concepto de Ingreso</DialogTitle>
                            <DialogDescription>
                               Define una nueva razón para los movimientos de entrada de inventario.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleAddReason)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="label"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Etiqueta</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Traslado entre Bodegas" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="value"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Valor (ID corto)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: warehouse_transfer" {...field} />
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
                <div className="grid gap-6">
                    {reasons.map((reason) => (
                        <div key={reason.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                            <div className="mb-2 sm:mb-0">
                                <p className="text-sm font-medium text-muted-foreground">ID: <span className="font-mono">{reason.id}</span> | Valor: <span className="font-mono">{reason.value}</span></p>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Label htmlFor={`reason-${reason.id}`} className="sr-only">Etiqueta</Label>
                                <Input
                                    id={`reason-${reason.id}`}
                                    value={reason.label}
                                    onChange={(e) => handleLabelChange(reason.id, e.target.value)}
                                    className="w-full sm:w-64"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
            </CardFooter>
        </Card>
    );
}
