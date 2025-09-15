
import { z } from 'zod';

export const AddProductFormSchema = z.object({
  name: z.string().min(1, 'Product name is required.'),
  sku: z.string().min(1, 'SKU is required.'),
  description: z.string().min(1, 'Description is required.'),
  categoryId: z.string().min(1, 'Category is required.'),
  vendorId: z.string().min(1, 'Supplier is required.'),
  price: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : val),
    z.coerce.number({ invalid_type_error: 'Price must be a number.' }).min(0, 'Price must be a non-negative number.').optional()
  ),
  stock: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : val),
    z.coerce.number({ invalid_type_error: 'Stock must be a number.' }).int('Stock must be a whole number.').min(0, 'Stock must be a non-negative number.').optional()
  ),
  restockThreshold: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : val),
    z.coerce.number({ invalid_type_error: 'Threshold must be a number.' }).int('Threshold must be a whole number.').min(0, 'Threshold must be a non-negative number.').optional()
  ),
  image: z.any().refine((file): file is File => file instanceof File && file.size > 0, 'Image is required.'),
});

export type AddProductFormValues = z.infer<typeof AddProductFormSchema>;

export type AddProductFormState = {
  message: string;
  errors?: {
    _form?: string[];
    name?: string[];
    sku?: string[];
    description?: string[];
    categoryId?: string[];
    vendorId?: string[];
    price?: string[];
    stock?: string[];
    restockThreshold?: string[];
    image?: string[];
  };
  success: boolean;
};

export const AddSupplierFormSchema = z.object({
  name: z.string().min(1, 'Supplier name is required.'),
  contact: z.object({
    email: z.string().email('Invalid email address.'),
    phone: z.string().min(1, 'Phone number is required.'),
  }),
  shippingPolicy: z.string().min(1, 'Shipping policy is required.'),
  returnPolicy: z.string().min(1, 'Return policy is required.'),
});

export type AddSupplierFormValues = z.infer<typeof AddSupplierFormSchema>;

export type AddSupplierFormState = {
  message: string;
  errors?: {
    _form?: string[];
    name?: string[];
    contact?: {
        email?: string[];
        phone?: string[];
    };
    shippingPolicy?: string[];
    returnPolicy?: string[];
  };
  success: boolean;
};


export const AddCategoryFormSchema = z.object({
    name: z.string().min(1, 'Category name is required.'),
    description: z.string().min(1, 'Description is required.'),
});

export type AddCategoryFormValues = z.infer<typeof AddCategoryFormSchema>;

export type AddCategoryFormState = {
    message: string;
    errors?: {
        _form?: string[];
        name?: string[];
        description?: string[];
    };
    success: boolean;
};

    