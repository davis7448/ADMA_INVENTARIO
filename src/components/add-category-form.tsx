
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
import { addCategoryAction } from '@/app/actions/categories';
import { useToast } from '@/hooks/use-toast';
import type { AddCategoryFormValues } from '@/lib/definitions';
import { AddCategoryFormSchema } from '@/lib/definitions';
import { Textarea } from './ui/textarea';

interface AddCategoryFormProps {
  onCategoryAdded: () => void;
}

export function AddCategoryForm({ onCategoryAdded }: AddCategoryFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const form = useForm<AddCategoryFormValues>({
    resolver: zodResolver(AddCategoryFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = (values: AddCategoryFormValues) => {
    startTransition(async () => {
      const result = await addCategoryAction(values);
      if (result.success) {
        toast({
          title: '¡Éxito!',
          description: result.message,
        });
        setOpen(false); 
        onCategoryAdded();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Algo salió mal.',
          variant: 'destructive',
        });
        if (result.errors) {
            Object.entries(result.errors).forEach(([key, value]) => {
                if (key !== '_form' && value) {
                    form.setError(key as keyof AddCategoryFormValues, {
                        type: 'manual',
                        message: value[0],
                    });
                }
            });
        }
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
        <Button>Añadir Categoría</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir Nueva Categoría</DialogTitle>
          <DialogDescription>
            Introduce los detalles de la nueva categoría.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre de la Categoría</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Electrónica" {...field} />
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
                                <Textarea placeholder="e.g., Gadgets y dispositivos" {...field} />
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
                        {isPending ? 'Añadiendo...' : 'Añadir Categoría'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
