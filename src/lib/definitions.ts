
import { z } from 'zod';

export const AddProductFormSchema = z.object({
  name: z.string().min(1, 'Product name is required.'),
  sku: z.string().min(1, 'SKU is required.'),
  description: z.string().min(1, 'Description is required.'),
  categoryId: z.string().min(1, 'Category is required.'),
  vendorId: z.string().min(1, 'Supplier is required.'),
  price: z.coerce.number().min(0, 'Price must be a non-negative number.'),
  stock: z.coerce.number().min(0, 'Stock must be a non-negative number.'),
  restockThreshold: z.coerce.number().min(0, 'Threshold must be a non-negative number.'),
  imageUrl: z.string().min(1, 'Product image is required.'),
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
    imageUrl?: string[];
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
