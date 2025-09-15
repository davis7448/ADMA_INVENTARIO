
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
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from '@/components/ui/form';
import { getSuppliers, getCategories } from '@/lib/api';
import { updateProductAction } from '@/app/actions/products';
import { useToast } from '@/hooks/use-toast';
import type { EditProductFormValues } from '@/lib/definitions';
import { EditProductFormSchema } from '@/lib/definitions';
import type { Supplier, Category, Product } from '@/lib/types';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Info } from 'lucide-react';

interface EditProductFormProps {
  product: Product;
  onProductUpdated: () => void;
  children: React.ReactNode;
}

export function EditProductForm({ product, onProductUpdated, children }: EditProductFormProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditProductFormValues>({
    resolver: zodResolver(EditProductFormSchema),
    defaultValues: {
      name: product.name,
      sku: product.sku || '',
      description: product.description,
      productType: product.productType || 'simple',
      categoryId: product.categoryId,
      vendorId: product.vendorId,
      price: product.price,
      stock: product.stock,
      restockThreshold: product.restockThreshold,
      image: undefined,
      contentLink: product.contentLink || '',
    },
  });

  const productType = form.watch('productType');

  useEffect(() => {
    if (open) {
        Promise.all([getSuppliers(), getCategories()]).then(([fetchedSuppliers, fetchedCategories]) => {
            setSuppliers(fetchedSuppliers);
            setCategories(fetchedCategories);
        });
    }
  }, [open]);

  const onSubmit = (values: EditProductFormValues) => {
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            if (key === 'image' && value instanceof File) {
                formData.append(key, value);
            } else if (typeof value !== 'object') {
                if (key === 'sku' && values.productType === 'variable') {
                    // Don't append SKU for variable products
                } else {
                    formData.append(key, String(value));
                }
            }
        }
    });

    startTransition(async () => {
        const result = await updateProductAction(product.id, formData);

        if (result.success) {
            toast({
              title: 'Success!',
              description: result.message,
            });
            setOpen(false); 
            onProductUpdated();
        } else {
            toast({
              title: 'Error',
              description: result.message || 'Something went wrong.',
              variant: 'destructive',
            });
            if (result.errors) {
                Object.entries(result.errors).forEach(([key, errorMessages]) => {
                    if (key in values && errorMessages) {
                         form.setError(key as keyof EditProductFormValues, {
                            type: 'manual',
                            message: errorMessages[0],
                        });
                    }
                });
            }
        }
    });
  };
  
  useEffect(() => {
    if (open) {
      form.reset({
        name: product.name,
        sku: product.sku,
        description: product.description,
        productType: product.productType || 'simple',
        categoryId: product.categoryId,
        vendorId: product.vendorId,
        price: product.price,
        stock: product.stock,
        restockThreshold: product.restockThreshold,
        image: undefined,
        contentLink: product.contentLink || '',
      });
    }
  }, [open, form, product]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update the details of the product below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField
                    control={form.control}
                    name="productType"
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel>Product Type</FormLabel>
                            <FormControl>
                                <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex flex-row space-x-4"
                                >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="simple" />
                                    </FormControl>
                                    <FormLabel className="font-normal">Simple</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <RadioGroupItem value="variable" />
                                    </FormControl>
                                    <FormLabel className="font-normal">Variable</FormLabel>
                                </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
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
                                     <Input 
                                        placeholder="e.g., WM-ERGO-01" 
                                        {...field} 
                                        disabled={productType === 'variable'}
                                        value={productType === 'variable' ? '' : field.value || ''}
                                    />
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
                <div className="flex gap-4 items-center">
                    <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="rounded-md object-cover" />
                    <FormField
                        control={form.control}
                        name="image"
                        render={({ field: { onChange, value, ...rest } }) => (
                            <FormItem className="flex-1">
                                <FormLabel>New Product Image (Optional)</FormLabel>
                                <FormControl>
                                <Input 
                                    type="file" 
                                    accept="image/png, image/jpeg, image/webp"
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
                </div>
                 <FormField
                    control={form.control}
                    name="contentLink"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Link de Contenido (Google Drive)</FormLabel>
                            <FormControl>
                                <Input placeholder="https://docs.google.com/..." {...field} />
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
                                <Select onValueChange={field.onChange} value={field.value}>
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
                                <Select onValueChange={field.onChange} value={field.value}>
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
                {productType === 'variable' && (
                     <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>Producto Variable</AlertTitle>
                        <AlertDescription>
                            El stock y el precio se determinan por la suma de sus variantes. La gestión de variantes estará disponible aquí.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Price</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        step="0.01" 
                                        placeholder="e.g., 79.99" 
                                        {...field} 
                                        value={productType === 'variable' ? '' : field.value ?? ''}
                                        disabled={productType === 'variable'}
                                    />
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
                                    <Input 
                                        type="number" 
                                        placeholder="e.g., 100" 
                                        {...field} 
                                        value={productType === 'variable' ? '' : field.value ?? ''} 
                                        onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}
                                        disabled={productType === 'variable'}
                                    />
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
                                    <Input type="number" placeholder="e.g., 10" {...field} value={field.value ?? ''} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
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
                     <Button type="submit" disabled={isPending}>
                        {isPending ? 'Updating Product...' : 'Update Product'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
