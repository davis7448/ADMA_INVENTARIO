

"use client";

import { useState } from 'react';
import type { DispatchOrder, User } from '@/lib/types';
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
import { useAuth } from '@/hooks/use-auth';

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
  const { user } = useAuth();

  const allExceptions = order.exceptions || [];

  const handleCheckboxChange = (trackingNumber: string, checked: boolean) => {
    setSelectedGuides(prev => ({ ...prev, [trackingNumber]: checked }));
  };
  
  const guidesToCancel = Object.entries(selectedGuides)
    .filter(([, isSelected]) => isSelected)
    .map(([trackingNumber]) => trackingNumber);

  const handleSelectAll = () => {
    const allSelected = allExceptions.reduce((acc, ex) => {
        acc[ex.trackingNumber] = true;
        return acc;
    }, {} as Record<string, boolean>);
    setSelectedGuides(allSelected);
  };

  const handleDeselectAll = () => {
    setSelectedGuides({});
  };

  const handleSubmit = async () => {
    if (guidesToCancel.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar al menos una guía para anular.' });
        return;
    }

    setIsProcessing(true);
    try {
        await cancelPendingDispatchItems(order.id, guidesToCancel, user);
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
                    <div className="flex justify-between items-center mb-2">
                        <Label className="font-semibold">Guías de Excepción Pendientes:</Label>
                        <div className="flex gap-2">
                             <Button variant="link" size="sm" className="p-0 h-auto" onClick={handleSelectAll}>Seleccionar todo</Button>
                             <Button variant="link" size="sm" className="p-0 h-auto" onClick={handleDeselectAll}>Deseleccionar todo</Button>
                        </div>
                    </div>
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
