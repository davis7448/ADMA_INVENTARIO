"use client";

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { uploadSolicitudImagesAction } from '@/app/actions/clickup';

// Adjunta imágenes a la tarea de ClickUp de una solicitud ya creada.
//
// Los comerciales NO tienen permiso de edición en ClickUp, así que no pueden subir nada
// allí. La subida la hace el servidor de ADMA con su propio token, igual que al crear la
// solicitud: esto solo reabre esa misma vía después, que es lo que faltaba cuando el envío
// inicial falla y las imágenes se quedan en el navegador del comercial.
export function SolicitudAttachImagesDialog({ taskId, productName, onClose, onUploaded }: {
    taskId: string | null;
    productName?: string;
    onClose: () => void;
    onUploaded?: () => void;
}) {
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async () => {
        if (!taskId) return;
        const files = Array.from(inputRef.current?.files || []);
        if (files.length === 0) {
            toast({ title: 'Sin imágenes', description: 'Elige al menos un archivo.', variant: 'destructive' });
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            for (const file of files) formData.append('images', file);
            const result = await uploadSolicitudImagesAction(taskId, formData);

            if (result.success) {
                toast({ title: 'Imágenes adjuntadas', description: `${result.uploaded} imagen(es) subida(s) a la tarea de ClickUp.` });
                onUploaded?.();
                onClose();
            } else {
                // Puede haber subido algunas y fallado otras: se dice cuántas entraron.
                toast({
                    title: 'Algunas imágenes no se subieron',
                    description: `${result.uploaded ?? 0} subida(s). ${result.error || ''}`.trim(),
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'No se pudieron adjuntar las imágenes.',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={!!taskId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Adjuntar Imágenes</DialogTitle>
                    <DialogDescription>
                        {productName ? `${productName} · ` : ''}Se suben a la tarea de ClickUp de esta solicitud.
                        No se guardan en ADMA.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <Label htmlFor="attach-images">Imágenes</Label>
                    <Input id="attach-images" ref={inputRef} type="file" accept="image/*" multiple disabled={isUploading} />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isUploading}>Cancelar</Button>
                    <Button onClick={handleUpload} disabled={isUploading}>
                        {isUploading ? 'Subiendo…' : 'Subir a ClickUp'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
