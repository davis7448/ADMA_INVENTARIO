
"use client";

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from '@/components/ui/form';
import { addVendedorAction } from '@/app/actions/vendedores';
import { useToast } from '@/hooks/use-toast';
import type { AddVendedorFormValues } from '@/lib/definitions';
import { AddVendedorFormSchema } from '@/lib/definitions';

interface AddVendedorFormProps {
  onVendedorAdded: () => void;
}

export function AddVendedorForm({ onVendedorAdded }: AddVendedorFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const form = useForm<AddVendedorFormValues>({
    resolver: zodResolver(AddVendedorFormSchema),
    defaultValues: {
      name: '',
      contact: {
          email: '',
          phone: '',
      },
    },
  });

  const onSubmit = (values: AddVendedorFormValues) => {
    startTransition(async () => {
      const result = await addVendedorAction(values);
      if (result.success) {
        toast({
          title: '¡Éxito!',
          description: result.message,
        });
        setOpen(false); 
        onVendedorAdded();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Algo salió mal.',
          variant: 'destructive',
        });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Añadir Vendedor</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Vendedor</DialogTitle>
          <DialogDescription>
            Introduce los detalles del nuevo vendedor.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre del Vendedor</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Juan Pérez" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="contact.email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email de Contacto</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., vendedor@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="contact.phone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Teléfono de Contacto</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., +1 234 567 890" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Cancelar
                        </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Añadiendo...' : 'Añadir Vendedor'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
