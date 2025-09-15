

"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Product, Vendedor, ProductReservation } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { updateProductReservations } from '@/lib/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';

interface ProductReservationDialogProps {
  product: Product;
  vendedores: Vendedor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ProductReservationDialog({ product, vendedores, open, onOpenChange, onSuccess }: ProductReservationDialogProps) {
  const [reservations, setReservations] = useState<ProductReservation[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const initialReservations = vendedores.map(v => ({
        vendedorId: v.id,
        vendedorName: v.name,
        quantity: product.reservations?.[v.id] || 0,
      }));
      setReservations(initialReservations);
    }
  }, [open, product, vendedores]);

  const handleQuantityChange = (vendedorId: string, value: string) => {
    const quantity = parseInt(value, 10) || 0;
    setReservations(prev =>
      prev.map(r => (r.vendedorId === vendedorId ? { ...r, quantity: Math.max(0, quantity) } : r))
    );
  };
  
  const totalReserved = useMemo(() => reservations.reduce((sum, r) => sum + r.quantity, 0), [reservations]);
  const originalTotalReserved = useMemo(() => {
    if (!product.reservations) return 0;
    return Object.values(product.reservations).reduce((sum, qty) => sum + qty, 0);
  }, [product.reservations]);

  const availableToReserve = product.stock + originalTotalReserved;

  const handleSave = async () => {
    if (totalReserved > availableToReserve) {
        toast({
            variant: 'destructive',
            title: 'Error de Stock',
            description: `No puedes reservar más del stock total disponible (${availableToReserve} unidades).`,
        });
        return;
    }

    setIsSaving(true);
    try {
        await updateProductReservations(product.id, reservations);
        toast({
            title: '¡Éxito!',
            description: 'Las reservas de inventario se han actualizado correctamente.',
        });
        onSuccess();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'No se pudieron guardar las reservas.';
        toast({
            variant: 'destructive',
            title: 'Error al Guardar',
            description: errorMessage,
        });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reservar Inventario para Vendedores</DialogTitle>
          <DialogDescription>
            Asigna unidades de <strong>{product.name}</strong> a las bodegas privadas de tus vendedores.
            El stock asignado se restará del inventario principal.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Disponible para Reservar</p>
                    <p className="text-2xl font-bold">{availableToReserve}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Total Reservado</p>
                    <p className="text-2xl font-bold text-blue-500">{totalReserved}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground">Stock Principal Restante</p>
                    <p className="text-2xl font-bold text-green-600">{availableToReserve - totalReserved}</p>
                </div>
            </div>
            <div className="max-h-[40vh] overflow-y-auto border rounded-lg">
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="w-[150px]">Cantidad a Reservar</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reservations.map(res => (
                            <TableRow key={res.vendedorId}>
                                <TableCell className="font-medium">{res.vendedorName}</TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        value={res.quantity}
                                        onChange={(e) => handleQuantityChange(res.vendedorId, e.target.value)}
                                        min="0"
                                        className="text-center"
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
        <DialogFooter>
            <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar Reservas'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
