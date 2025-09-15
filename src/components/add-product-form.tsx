"use client";

import { useState, useRef, useTransition } from 'react';
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
import { suppliers } from '@/lib/data';
import { addProduct, type AddProductFormState } from '@/app/actions/products';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';

export function AddProductForm() {
  const { toast } = useToast();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<AddProductFormState['errors']>({});

  const handleSubmit = (formData: FormData) => {
    setErrors({});
    startTransition(async () => {
      const result = await addProduct({} as AddProductFormState, formData);
      if (result.success) {
        toast({
          title: 'Success!',
          description: result.message,
        });
        closeButtonRef.current?.click();
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
        if (result.errors) {
          setErrors(result.errors);
        }
      }
    });
  };
  

  return (
    <Dialog onOpenChange={() => setErrors({})}>
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
        <form action={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input id="name" name="name" placeholder="e.g., Ergo-Wireless Mouse" />
                {errors?.name && <p className="text-sm font-medium text-destructive">{errors.name[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" name="sku" placeholder="e.g., WM-ERGO-01" />
                {errors?.sku && <p className="text-sm font-medium text-destructive">{errors.sku[0]}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" placeholder="A brief description of the product." />
              {errors?.description && <p className="text-sm font-medium text-destructive">{errors.description[0]}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="e.g., Electronics" />
                {errors?.category && <p className="text-sm font-medium text-destructive">{errors.category[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorId">Supplier</Label>
                 <Select name="vendorId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors?.vendorId && <p className="text-sm font-medium text-destructive">{errors.vendorId[0]}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input id="price" name="price" type="number" defaultValue="0" />
                 {errors?.price && <p className="text-sm font-medium text-destructive">{errors.price[0]}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input id="stock" name="stock" type="number" defaultValue="0" />
                 {errors?.stock && <p className="text-sm font-medium text-destructive">{errors.stock[0]}</p>}
              </div>
               <div className="space-y-2">
                <Label htmlFor="restockThreshold">Restock Threshold</Label>
                <Input id="restockThreshold" name="restockThreshold" type="number" defaultValue="0" />
                {errors?.restockThreshold && <p className="text-sm font-medium text-destructive">{errors.restockThreshold[0]}</p>}
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" ref={closeButtonRef}>
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Adding Product...' : 'Add Product'}
                </Button>
            </DialogFooter>
          </form>
      </DialogContent>
    </Dialog>
  );
}
