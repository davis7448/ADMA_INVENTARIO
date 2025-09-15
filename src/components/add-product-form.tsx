"use client";

import { useEffect, useRef } from 'react';
import { useActionState } from 'react';
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
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from '@/components/ui/form';
import { suppliers } from '@/lib/data';
import { addProduct, type AddProductFormState } from '@/app/actions/products';
import { useToast } from '@/hooks/use-toast';
import { useFormStatus } from 'react-dom';

const AddProductFormSchema = z.object({
    name: z.string().min(1, 'Product name is required.'),
    sku: z.string().min(1, 'SKU is required.'),
    description: z.string().min(1, 'Description is required.'),
    category: z.string().min(1, 'Category is required.'),
    vendorId: z.string().min(1, 'Supplier is required.'),
    price: z.coerce.number().min(0, 'Price must be a non-negative number.'),
    stock: z.coerce.number().min(0, 'Stock must be a non-negative number.'),
    restockThreshold: z.coerce.number().min(0, 'Threshold must be a non-negative number.'),
  });

type FormValues = z.infer<typeof AddProductFormSchema>;

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
      <Button type="submit" disabled={pending}>
        {pending ? 'Adding Product...' : 'Add Product'}
      </Button>
    );
}

export function AddProductForm() {
  const { toast } = useToast();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  
  const initialState: AddProductFormState = { message: '', errors: {}, success: false };
  const [state, formAction] = useActionState(addProduct, initialState);

  const form = useForm<FormValues>({
    resolver: zodResolver(AddProductFormSchema),
    defaultValues: {
      name: '',
      sku: '',
      description: '',
      category: '',
      vendorId: '',
      price: 0,
      stock: 0,
      restockThreshold: 0,
    },
  });

  useEffect(() => {
    if (state.success) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      closeButtonRef.current?.click();
      form.reset();
    } else if (state.message && state.errors) {
      toast({
        title: 'Error',
        description: state.message,
        variant: 'destructive',
      });
      Object.entries(state.errors).forEach(([key, value]) => {
        form.setError(key as keyof FormValues, {
          type: 'manual',
          message: value?.[0],
        });
      });
    }
  }, [state, toast, form]);
  
  return (
    <Dialog onOpenChange={() => form.reset()}>
      <DialogTrigger asChild>
        <Button>Add Product</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Enter the details of the new product below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form action={formAction} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Product Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Ergo-Wireless Mouse" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="sku"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>SKU</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., WM-ERGO-01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="A brief description of the product." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., Electronics" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="vendorId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Supplier</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                        <SelectValue placeholder="Select a supplier" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {suppliers.map(supplier => (
                                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Price</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="stock"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Stock</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="restockThreshold"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Restock Threshold</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" ref={closeButtonRef}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <SubmitButton />
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
