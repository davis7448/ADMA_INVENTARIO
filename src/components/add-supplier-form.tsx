
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
import { addSupplierAction } from '@/app/actions/suppliers';
import { useToast } from '@/hooks/use-toast';
import type { AddSupplierFormValues } from '@/lib/definitions';
import { AddSupplierFormSchema } from '@/lib/definitions';
import { Textarea } from './ui/textarea';

interface AddSupplierFormProps {
  onSupplierAdded: () => void;
}

export function AddSupplierForm({ onSupplierAdded }: AddSupplierFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const form = useForm<AddSupplierFormValues>({
    resolver: zodResolver(AddSupplierFormSchema),
    defaultValues: {
      name: '',
      contact: {
          email: '',
          phone: '',
      },
      shippingPolicy: '',
      returnPolicy: '',
    },
  });

  const onSubmit = (values: AddSupplierFormValues) => {
    startTransition(async () => {
      const result = await addSupplierAction(values);
      if (result.success) {
        toast({
          title: 'Success!',
          description: result.message,
        });
        setOpen(false); 
        onSupplierAdded();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Something went wrong.',
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
        <Button>Add Supplier</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Add New Supplier</DialogTitle>
          <DialogDescription>
            Enter the details of the new supplier below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Supplier Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Global Tech Supplies" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="contact.email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Contact Email</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., contact@globaltech.com" {...field} />
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
                                <FormLabel>Contact Phone</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., +1 234 567 890" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="shippingPolicy"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Shipping Policy</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe the shipping policy..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="returnPolicy"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Return Policy</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe the return policy..." {...field} />
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
                        {isPending ? 'Adding Supplier...' : 'Add Supplier'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
