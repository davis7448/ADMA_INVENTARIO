import { z } from 'zod';

export const AddProductFormSchema = z.object({
  name: z.string().min(1, 'Product name is required.'),
  sku: z.string().min(1, 'SKU is required.'),
  description: z.string().min(1, 'Description is required.'),
  category: z.string().min(1, 'Category is required.'),
  vendorId: z.string().min(1, 'Supplier is required.'),
  price: z.coerce.number().min(0, 'Price must be a non-negative number.'),
  stock: z.coerce.number().min(0, 'Stock must be a non-negative number.'),
  restockThreshold: z.coerce.number().min(0, 'Threshold must be a non-negative number.'),
});

export type AddProductFormValues = z.infer<typeof AddProductFormSchema>;

export type AddProductFormState = {
  message: string;
  errors?: {
    _form?: string[];
    name?: string[];
    sku?: string[];
    description?: string[];
    category?: string[];
    vendorId?: string[];
    price?: string[];
    stock?: string[];
    restockThreshold?: string[];
  };
  success: boolean;
};
