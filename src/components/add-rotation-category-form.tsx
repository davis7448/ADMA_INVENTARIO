
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
import { addRotationCategory } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';

const AddRotationCategoryFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido.'),
  description: z.string().min(1, 'La descripción es requerida.'),
});

type AddRotationCategoryFormValues = z.infer<typeof AddRotationCategoryFormSchema>;

interface AddRotationCategoryFormProps {
  onCategoryAdded: () => void;
}

export function AddRotationCategoryForm({ onCategoryAdded }: AddRotationCategoryFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const form = useForm<AddRotationCategoryFormValues>({
    resolver: zodResolver(AddRotationCategoryFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = (values: AddRotationCategoryFormValues) => {
    startTransition(async () => {
      try {
        await addRotationCategory(values);
        toast({
          title: '¡Éxito!',
          description: "Clasificación añadida correctamente.",
        });
        setOpen(false); 
        onCategoryAdded();
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
        <Button>Añadir Clasificación</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir Nueva Clasificación</DialogTitle>
          <DialogDescription>
            Introduce los detalles de la nueva clasificación de rotación.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Escalada" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Ej: Productos de alta demanda y crecimiento." {...field} />
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
                        {isPending ? 'Añadiendo...' : 'Añadir'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
