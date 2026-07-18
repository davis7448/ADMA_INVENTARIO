"use client";

import { useEffect, useState } from 'react';
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
import { getImportSettings, updateImportSettings } from '@/lib/api';
import { DEFAULT_IMPORT_TARIFF_PER_CBM } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export function ImportTariffManagement({ canEdit }: { canEdit: boolean }) {
    const [tariffPerCbm, setTariffPerCbm] = useState<number>(DEFAULT_IMPORT_TARIFF_PER_CBM);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        getImportSettings()
            .then(settings => setTariffPerCbm(settings.tariffPerCbm))
            .finally(() => setIsLoading(false));
    }, []);

    const handleSave = async () => {
        if (!tariffPerCbm || tariffPerCbm <= 0) {
            toast({ title: 'Error', description: 'La tarifa debe ser un valor mayor a 0.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            await updateImportSettings({ tariffPerCbm });
            toast({ title: '¡Éxito!', description: 'La tarifa de importación se guardó correctamente.' });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudo guardar la tarifa. Inténtalo de nuevo.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tarifa de Importación</CardTitle>
                <CardDescription>
                    Valor en COP por metro cúbico (m³) usado para calcular el costo estimado
                    de la mercancía por llegar: costo de producto + tarifa × CBM unitario.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-2">
                    <Label htmlFor="tariff-per-cbm" className="whitespace-nowrap">COP por m³</Label>
                    <Input
                        id="tariff-per-cbm"
                        type="number"
                        min="0"
                        step="10000"
                        value={isLoading ? '' : tariffPerCbm}
                        placeholder={isLoading ? 'Cargando…' : undefined}
                        onChange={(e) => setTariffPerCbm(Number(e.target.value))}
                        className="w-44 text-right"
                        disabled={!canEdit || isLoading || isSaving}
                    />
                </div>
            </CardContent>
            {canEdit && (
                <CardFooter className="border-t px-6 py-4">
                    <Button onClick={handleSave} disabled={isSaving || isLoading}>
                        {isSaving ? 'Guardando...' : 'Guardar Tarifa'}
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
