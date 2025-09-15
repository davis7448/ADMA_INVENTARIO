
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
  name: z.string().min(1, 'Carrier name is required.'),
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
          title: 'Success!',
          description: "Carrier added successfully.",
        });
        setOpen(false); 
        onCarrierAdded();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Something went wrong.',
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
        <Button>Add Carrier</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Carrier</DialogTitle>
          <DialogDescription>
            Enter the name for the new carrier.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Carrier Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., DHL" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Adding Carrier...' : 'Add Carrier'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
