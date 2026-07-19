"use client";

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getSolicitudEvidenceAction } from '@/app/actions/clickup';
import type { ClickUpAttachment } from '@/lib/clickup';
import { ExternalLink } from 'lucide-react';

// Visor de evidencia de creación: muestra los adjuntos de la tarea de ClickUp
// en vivo (no se almacenan en ADMA).
export function SolicitudEvidenceDialog({ modificacionId, productName, onClose }: {
    modificacionId: string | null;
    productName?: string;
    onClose: () => void;
}) {
    const [attachments, setAttachments] = useState<ClickUpAttachment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!modificacionId) return;
        setIsLoading(true);
        setError(null);
        setAttachments([]);
        getSolicitudEvidenceAction(modificacionId)
            .then(result => {
                if (result.success) {
                    setAttachments(result.attachments || []);
                } else {
                    setError(result.error || 'No se pudo cargar la evidencia.');
                }
            })
            .catch(() => setError('No se pudo cargar la evidencia.'))
            .finally(() => setIsLoading(false));
    }, [modificacionId]);

    const images = attachments.filter(a => a.isImage);
    const otherFiles = attachments.filter(a => !a.isImage);

    return (
        <Dialog open={!!modificacionId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Evidencia de Creación</DialogTitle>
                    <DialogDescription>
                        {productName ? `${productName} · ` : ''}Adjuntos de la tarea en ClickUp (en vivo).
                    </DialogDescription>
                </DialogHeader>
                {isLoading ? (
                    <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                ) : error ? (
                    <p className="text-sm text-destructive text-center py-6">{error}</p>
                ) : images.length === 0 && otherFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                        La tarea aún no tiene adjuntos de evidencia en ClickUp.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {images.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {images.map(img => (
                                    <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className="block">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={img.thumbnailUrl || img.url}
                                            alt={img.title}
                                            className="rounded-md border object-contain w-full max-h-72 bg-muted/30"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1 truncate">{img.title}</p>
                                    </a>
                                ))}
                            </div>
                        )}
                        {otherFiles.map(file => (
                            <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline-offset-2 hover:underline">
                                <ExternalLink className="h-4 w-4" />{file.title}
                            </a>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
