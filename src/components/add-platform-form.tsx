
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
import { addPlatform } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const AddPlatformFormSchema = z.object({
  name: z.string().min(1, 'El nombre de la plataforma es requerido.'),
});

type AddPlatformFormValues = z.infer<typeof AddPlatformFormSchema>;

interface AddPlatformFormProps {
  onPlatformAdded: () => void;
}

export function AddPlatformForm({ onPlatformAdded }: AddPlatformFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const form = useForm<AddPlatformFormValues>({
    resolver: zodResolver(AddPlatformFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = (values: AddPlatformFormValues) => {
    startTransition(async () => {
      try {
        await addPlatform(values);
        toast({
          title: '¡Éxito!',
          description: "Plataforma añadida con éxito.",
        });
        setOpen(false); 
        onPlatformAdded();
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
        <Button>Añadir Plataforma</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir Nueva Plataforma</DialogTitle>
          <DialogDescription>
            Introduce el nombre de la nueva plataforma de ventas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre de la Plataforma</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Mercado Libre" {...field} />
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
                        {isPending ? 'Añadiendo...' : 'Añadir Plataforma'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
