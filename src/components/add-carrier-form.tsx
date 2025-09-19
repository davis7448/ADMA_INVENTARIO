
"use client";

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { addCarrier } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const AddCarrierFormSchema = z.object({
  name: z.string().min(1, 'El nombre de la transportadora es requerido.'),
});

type AddCarrierFormValues = z.infer<typeof AddCarrierFormSchema>;

interface AddCarrierFormProps {
  onCarrierAdded: () => void;
}

export function AddCarrierForm({ onCarrierAdded }: AddCarrierFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const form = useForm<AddCarrierFormValues>({
    resolver: zodResolver(AddCarrierFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = (values: AddCarrierFormValues) => {
    startTransition(async () => {
      try {
        await addCarrier(values);
        toast({
          title: '¡Éxito!',
          description: "Transportadora añadida con éxito.",
        });
        setOpen(false); 
        onCarrierAdded();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Algo salió mal.',
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
        <Button>Añadir Transportadora</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir Nueva Transportadora</DialogTitle>
          <DialogDescription>
            Introduce el nombre de la nueva transportadora.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre de la Transportadora</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Servientrega" {...field} />
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
                        {isPending ? 'Añadiendo...' : 'Añadir Transportadora'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
