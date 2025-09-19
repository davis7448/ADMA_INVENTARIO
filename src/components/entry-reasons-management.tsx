
"use client";

import { useState, useTransition } from 'react';
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
import { updateEntryReasonsAction } from '@/app/actions/entry-reasons';

interface EntryReasonsManagementProps {
    initialEntryReasons: EntryReason[];
}

export function EntryReasonsManagement({ initialEntryReasons }: EntryReasonsManagementProps) {
    const [reasons, setReasons] = useState<EntryReason[]>(initialEntryReasons);
    const [isSaving, startTransition] = useTransition();
    const { toast } = useToast();

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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Conceptos de Ingreso de Mercancía</CardTitle>
                <CardDescription>
                    Define los motivos que se pueden seleccionar al registrar una entrada de inventario.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6">
                    {reasons.map((reason) => (
                        <div key={reason.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                            <div className="mb-2 sm:mb-0">
                                <p className="text-sm font-medium text-muted-foreground">ID: <span className="font-mono">{reason.value}</span></p>
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
