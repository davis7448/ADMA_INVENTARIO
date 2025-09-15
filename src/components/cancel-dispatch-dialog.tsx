
"use client";

import { useState } from 'react';
import type { DispatchOrder } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from './ui/checkbox';
import { cancelPendingDispatchItems } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle } from 'lucide-react';

interface CancelDispatchDialogProps {
  order: DispatchOrder;
  children: React.ReactNode;
  onCancelled: () => void;
}

export function CancelDispatchDialog({ order, children, onCancelled }: CancelDispatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedGuides, setSelectedGuides] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const handleCheckboxChange = (trackingNumber: string, checked: boolean) => {
    setSelectedGuides(prev => ({ ...prev, [trackingNumber]: checked }));
  };
  
  const guidesToCancel = Object.entries(selectedGuides)
    .filter(([, isSelected]) => isSelected)
    .map(([trackingNumber]) => trackingNumber);

  const handleSubmit = async () => {
    if (guidesToCancel.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar al menos una guía para anular.' });
        return;
    }

    setIsProcessing(true);
    try {
        await cancelPendingDispatchItems(order.id, guidesToCancel);
        toast({ title: 'Éxito', description: 'Los items pendientes han sido anulados y el stock ha sido restaurado.' });
        onCancelled();
        setOpen(false);
        setSelectedGuides({});
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        toast({ variant: 'destructive', title: 'Error al anular', description: errorMessage });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const allExceptions = order.exceptions || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular Items Pendientes</DialogTitle>
          <DialogDescription>
            Selecciona las guías de excepción que deseas anular. Los productos asociados volverán al stock principal.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
            {allExceptions.length > 0 ? (
                <div className="space-y-2">
                    <Label className="font-semibold">Guías de Excepción Pendientes:</Label>
                    {allExceptions.map((ex) => (
                        <div key={ex.trackingNumber} className="flex items-center space-x-2">
                            <Checkbox
                                id={ex.trackingNumber}
                                checked={selectedGuides[ex.trackingNumber] || false}
                                onCheckedChange={(checked) => handleCheckboxChange(ex.trackingNumber, !!checked)}
                            />
                            <Label htmlFor={ex.trackingNumber} className="font-mono text-sm">
                                {ex.trackingNumber}
                            </Label>
                        </div>
                    ))}
                </div>
            ) : (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No hay excepciones</AlertTitle>
                    <AlertDescription>
                        Esta orden no tiene items pendientes para anular.
                    </AlertDescription>
                </Alert>
            )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button 
            variant="destructive"
            onClick={handleSubmit} 
            disabled={isProcessing || allExceptions.length === 0 || guidesToCancel.length === 0}
          >
            {isProcessing ? 'Anulando...' : `Anular (${guidesToCancel.length}) Guía(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
