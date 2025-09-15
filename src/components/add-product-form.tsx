
"use client";

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useActionState } from 'react';
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
import { getSuppliers, getCategories } from '@/lib/api';
import { addProductAction } from '@/app/actions/products';
import { useToast } from '@/hooks/use-toast';
import type { AddProductFormValues } from '@/lib/definitions';
import { AddProductFormSchema } from '@/lib/definitions';
import type { Supplier, Category } from '@/lib/types';
import { useFormStatus } from 'react-dom';

interface AddProductFormProps {
  onProductAdded: () => void;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Adding Product...' : 'Add Product'}
        </Button>
    )
}

export function AddProductForm({ onProductAdded }: AddProductFormProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  
  const [state, formAction] = useActionState(addProductAction, {
    message: '',
    errors: {},
    success: false,
  });

  const form = useForm<AddProductFormValues>({
    resolver: zodResolver(AddProductFormSchema),
    defaultValues: {
      name: '',
      sku: '',
      description: '',
      categoryId: '',
      vendorId: '',
      price: undefined,
      stock: undefined,
      restockThreshold: undefined,
      image: undefined,
    },
  });

  useEffect(() => {
    if (open) {
        Promise.all([getSuppliers(), getCategories()]).then(([fetchedSuppliers, fetchedCategories]) => {
            setSuppliers(fetchedSuppliers);
            setCategories(fetchedCategories);
        });
    }
  }, [open]);

  useEffect(() => {
    if (state.success) {
      toast({
        title: 'Success!',
        description: state.message,
      });
      setOpen(false); 
      onProductAdded();
      form.reset();
    } else if (state.message && !state.success) {
       toast({
        title: 'Error',
        description: state.message || 'Something went wrong.',
        variant: 'destructive',
      });
       if (state.errors) {
            Object.entries(state.errors).forEach(([key, value]) => {
                if (key !== '_form' && value) {
                    form.setError(key as keyof AddProductFormValues, {
                        type: 'manual',
                        message: value[0],
                    });
                }
            });
        }
    }
  }, [state, onProductAdded, form, toast]);


  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <form
                ref={formRef} 
                action={formAction}
                className="space-y-4"
            >
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
                 <FormField
                    control={form.control}
                    name="image"
                    render={({ field: { onChange, value, ...rest } }) => (
                        <FormItem>
                            <FormLabel>Product Image</FormLabel>
                            <FormControl>
                               <Input 
                                type="file" 
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    onChange(file);
                                }}
                                {...rest}
                               />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {categories.map(category => (
                                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                        </Trigger>
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
                                    <Input type="number" step="0.01" placeholder="e.g., 79.99" {...field} value={field.value ?? ''} />
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
                                    <Input type="number" placeholder="e.g., 100" {...field} value={field.value ?? ''} />
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
                                    <Input type="number" placeholder="e.g., 10" {...field} value={field.value ?? ''} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
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
