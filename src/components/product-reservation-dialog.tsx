

"use client";

import { useState, useMemo, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Product, Vendedor, Platform, Reservation } from '@/lib/types';
import type { CreateReservationFormValues } from '@/lib/definitions';
import { CreateReservationFormSchema } from '@/lib/definitions';
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
import { createReservationAction } from '@/app/actions/products';
import { deleteReservation } from '@/lib/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/hooks/use-auth';

interface ProductReservationDialogProps {
  product: Product;
  vendedores: Vendedor[];
  platforms: Platform[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ProductReservationDialog({ product, vendedores, platforms, open, onOpenChange, onSuccess }: ProductReservationDialogProps) {
  const [isProcessing, startTransition] = useTransition();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();

  const form = useForm<CreateReservationFormValues>({
    resolver: zodResolver(CreateReservationFormSchema),
    defaultValues: {
        vendedorId: '',
        platformId: '',
        customerEmail: '',
        externalId: '',
        quantity: 1,
        variantId: '',
    },
  });

  const selectedVariant = useMemo(() => {
    if (product.productType === 'variable' && selectedVariantId) {
        return product.variants?.find(v => v.id === selectedVariantId);
    }
    return null;
  }, [product, selectedVariantId]);

  const totalReserved = useMemo(() => {
    if (!product.reservations) return 0;
  
    if (product.productType === 'simple') {
      return product.reservations.reduce((sum, r) => sum + r.quantity, 0);
    }
  
    // If a specific variant is selected, show reservations for it
    if (selectedVariant) {
      return product.reservations
        .filter(r => r.variantId === selectedVariant.id)
        .reduce((sum, r) => sum + r.quantity, 0);
    }
  
    // If no variant is selected, show the sum of all reservations for the product
    return product.reservations.reduce((sum, r) => sum + r.quantity, 0);
  }, [product, selectedVariant]);
  
  const stockFisico = useMemo(() => {
    // If a specific variant is selected, show its stock
    if (selectedVariant) {
      return selectedVariant.stock;
    }
    // Otherwise, show the total stock of the parent product
    return product.stock;
  }, [product, selectedVariant]);
  
  const availableToReserve = stockFisico - totalReserved;
  
  useEffect(() => {
    if (open) {
      form.reset();
      setSelectedVariantId(undefined);
    }
  }, [open, form]);

  const onSubmit = (values: CreateReservationFormValues) => {
    if (product.productType === 'variable') {
        if (!selectedVariantId) {
            toast({
                variant: 'destructive',
                title: 'Error de Validación',
                description: `Debe seleccionar una variante para reservar.`,
            });
            return;
        }
        values.variantId = selectedVariantId;
        values.variantSku = product.variants?.find(v => v.id === selectedVariantId)?.sku;
    }

    if (values.quantity > availableToReserve) {
        toast({
            variant: 'destructive',
            title: 'Error de Stock',
            description: `No puedes reservar más del stock disponible (${availableToReserve} unidades).`,
        });
        return;
    }

    startTransition(async () => {
      const result = await createReservationAction(product.id, values, user);

      if (result.success) {
        toast({
            title: '¡Éxito!',
            description: 'La reserva se ha creado correctamente.',
        });
        form.reset();
        setSelectedVariantId(undefined);
        onSuccess();
      } else {
        const errorMessage = result.message || 'No se pudo crear la reserva.';
        toast({
            variant: 'destructive',
            title: 'Error al Crear',
            description: errorMessage,
        });
      }
    });
  };

  const handleDeleteReservation = (reservationId: string) => {
    startTransition(async () => {
        try {
            await deleteReservation(reservationId);
            toast({
                title: 'Reserva Eliminada',
                description: 'La reserva ha sido eliminada con éxito.',
            });
            onSuccess();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'No se pudo eliminar la reserva.';
            toast({
                variant: 'destructive',
                title: 'Error al Eliminar',
                description: errorMessage,
            });
        }
    });
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar Reservas de Inventario</DialogTitle>
          <DialogDescription>
            Crea o elimina reservas para <strong>{product.name}</strong>. Las reservas descuentan del stock disponible, no del físico.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Form to create new reservation */}
            <div className="space-y-4">
                <h3 className="font-semibold text-lg">Crear Nueva Reserva</h3>
                <div className="grid grid-cols-3 gap-4 text-center p-4 bg-muted rounded-lg">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Stock Físico</p>
                        <p className="text-2xl font-bold">{stockFisico}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Reservado</p>
                        <p className="text-2xl font-bold text-blue-500">{totalReserved}</p>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Disponible</p>
                        <p className="text-2xl font-bold text-green-600">{availableToReserve}</p>
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {product.productType === 'variable' && (
                             <FormItem>
                                <FormLabel>Variante</FormLabel>
                                <Select onValueChange={setSelectedVariantId} value={selectedVariantId}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Selecciona una variante" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {product.variants?.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.sku}) - Stock: {v.stock}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                        <FormField
                            control={form.control}
                            name="vendedorId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vendedor</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Selecciona un vendedor" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {vendedores.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="platformId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Plataforma</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Selecciona una plataforma" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="customerEmail"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email del Cliente</FormLabel>
                                    <FormControl>
                                        <Input placeholder="cliente@email.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="externalId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>ID Externo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="ID de la venta en la plataforma" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cantidad</FormLabel>
                                    <FormControl>
                                        <Input type="number" min="1" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isProcessing}>
                            {isProcessing ? 'Creando...' : 'Crear Reserva'}
                        </Button>
                    </form>
                </Form>
            </div>

            {/* Table of existing reservations */}
            <div className="space-y-4">
                <h3 className="font-semibold text-lg">Reservas Activas</h3>
                 <div className="max-h-[55vh] overflow-y-auto border rounded-lg">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary">
                            <TableRow>
                                <TableHead>Vendedor</TableHead>
                                <TableHead>Variante (SKU)</TableHead>
                                <TableHead>Cant.</TableHead>
                                <TableHead>Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {product.reservations && product.reservations.length > 0 ? (
                                product.reservations.map(res => (
                                    <TableRow key={res.id}>
                                        <TableCell className="font-medium text-xs">{vendedores.find(v => v.id === res.vendedorId)?.name || 'N/A'}</TableCell>
                                        <TableCell className="font-mono text-xs">{res.variantSku || 'N/A'}</TableCell>
                                        <TableCell className="font-bold">{res.quantity}</TableCell>
                                        <TableCell>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={isProcessing}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta acción no se puede deshacer. Se liberará el stock reservado.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteReservation(res.id)}>
                                                            Eliminar
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">No hay reservas para este producto.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
        <DialogFooter>
            <DialogClose asChild>
                <Button variant="secondary">Cerrar</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
