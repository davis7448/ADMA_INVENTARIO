"use client";

import { useEffect, useState } from 'react';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DEFAULT_CRM_CONFIG, loadCrmConfig, updateCrmConfig, type CrmConfig } from '@/lib/client-volume';
import { useToast } from '@/hooks/use-toast';

export function CrmConfigManagement({ canEdit }: { canEdit: boolean }) {
    const [config, setConfig] = useState<CrmConfig>(DEFAULT_CRM_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadCrmConfig().then(setConfig).finally(() => setIsLoading(false));
    }, []);

    const set = (key: keyof CrmConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setConfig(prev => ({ ...prev, [key]: Number(e.target.value) }));

    const handleSave = async () => {
        if (config.tierBThreshold >= config.tierAThreshold) {
            toast({ title: 'Error', description: 'El umbral del tier B debe ser menor que el del tier A.', variant: 'destructive' });
            return;
        }
        if (config.warnDays >= config.alertDays) {
            toast({ title: 'Error', description: 'Los días de alerta ámbar deben ser menos que los de alerta roja.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            await updateCrmConfig(config);
            toast({ title: '¡Éxito!', description: 'Configuración del CRM guardada.' });
        } catch {
            toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Clasificación y Seguimiento de Clientes (CRM)</CardTitle>
                <CardDescription>
                    Umbrales del tier por volumen de pedidos y días sin contacto para las alertas de seguimiento.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="tier-a">Cliente A desde (COP en pedidos)</Label>
                        <Input id="tier-a" type="number" min="0" step="100000" value={isLoading ? '' : config.tierAThreshold} onChange={set('tierAThreshold')} className="mt-1" disabled={!canEdit || isLoading || isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="tier-b">Cliente B desde (COP en pedidos)</Label>
                        <Input id="tier-b" type="number" min="0" step="100000" value={isLoading ? '' : config.tierBThreshold} onChange={set('tierBThreshold')} className="mt-1" disabled={!canEdit || isLoading || isSaving} />
                        <p className="text-xs text-muted-foreground mt-1">Menos que B = tier C. Sin compras = "Nuevo".</p>
                    </div>
                    <div>
                        <Label htmlFor="warn-days">Alerta ámbar: días sin contacto</Label>
                        <Input id="warn-days" type="number" min="1" value={isLoading ? '' : config.warnDays} onChange={set('warnDays')} className="mt-1" disabled={!canEdit || isLoading || isSaving} />
                    </div>
                    <div>
                        <Label htmlFor="alert-days">Alerta roja: días sin contacto</Label>
                        <Input id="alert-days" type="number" min="2" value={isLoading ? '' : config.alertDays} onChange={set('alertDays')} className="mt-1" disabled={!canEdit || isLoading || isSaving} />
                    </div>
                </div>
            </CardContent>
            {canEdit && (
                <CardFooter className="border-t px-6 py-4">
                    <Button onClick={handleSave} disabled={isSaving || isLoading}>
                        {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
