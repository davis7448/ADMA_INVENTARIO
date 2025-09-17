

import { z } from 'zod';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];


const ProductVariantSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Variant name is required.'),
  sku: z.string().min(1, 'Variant SKU is required.'),
  priceDropshipping: z.coerce.number().min(0, 'Price must be non-negative.'),
  priceWholesale: z.coerce.number().min(0, 'Price must be non-negative.').optional(),
  stock: z.coerce.number().int().min(0, 'Stock must be a non-negative.'),
});

const ProductFormSchemaBase = z.object({
  name: z.string().min(1, 'Product name is required.'),
  sku: z.string().optional(),
  description: z.string().min(1, 'Description is required.'),
  productType: z.enum(['simple', 'variable'], {
    required_error: "You need to select a product type.",
  }),
  categoryId: z.string().min(1, 'Category is required.'),
  vendorId: z.string().min(1, 'Supplier is required.'),
  priceDropshipping: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : val),
    z.coerce.number({ invalid_type_error: 'Price must be a number.' }).min(0, 'Price must be a non-negative number.').optional()
  ),
  priceWholesale: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : val),
    z.coerce.number({ invalid_type_error: 'Price must be a number.' }).min(0, 'Price must be non-negative.').optional()
  ),
  cost: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : val),
    z.coerce.number({ invalid_type_error: 'Cost must be a number.' }).min(0, 'Cost must be non-negative.').optional()
  ),
  purchaseDate: z.date().optional(),
  stock: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : val),
    z.coerce.number({ invalid_type_error: 'Stock must be a number.' }).int('Stock must be a whole number.').min(0, 'Stock must be a non-negative number.').optional()
  ),
  contentLink: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
  variants: z.array(ProductVariantSchema).optional(),
});


export const AddProductFormSchema = ProductFormSchemaBase.extend({
    image: z
      .any()
      .refine((file) => file, 'Image is required.')
      .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 2MB.`)
      .refine(
        (file) => ACCEPTED_IMAGE_TYPES.includes(file?.type),
        'Only .jpg, .jpeg, .png and .webp formats are supported.'
      ),
  }).superRefine((data, ctx) => {
    if (data.productType === 'simple') {
        if (!data.sku || data.sku.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'SKU is required for simple products.',
                path: ['sku'],
            });
        }
    } else if (data.productType === 'variable') {
      if (!data.variants || data.variants.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Variable products must have at least one variant.',
            path: ['variants'],
        });
      }
    }
});

export type AddProductFormValues = z.infer<typeof AddProductFormSchema>;

export type AddProductFormState = {
  message: string;
  errors?: z.ZodError<AddProductFormValues>['formErrors']['fieldErrors'];
  success: boolean;
};

export const EditProductFormSchema = ProductFormSchemaBase.extend({
    image: z
      .any()
      .optional()
      .refine(
        (file) => !file || file.size <= MAX_FILE_SIZE,
        `Max file size is 2MB.`
      )
      .refine(
        (file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type),
        'Only .jpg, .jpeg, .png and .webp formats are supported.'
      ),
  }).superRefine((data, ctx) => {
    if (data.productType === 'simple') {
        if (!data.sku || data.sku.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'SKU is required for simple products.',
                path: ['sku'],
            });
        }
    } else if (data.productType === 'variable') {
        if (!data.variants || data.variants.length === 0) {
          ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Variable products must have at least one variant.',
              path: ['variants'],
          });
        }
      }
});
  
export type EditProductFormValues = z.infer<typeof EditProductFormSchema>;
  
export type EditProductFormState = Omit<AddProductFormState, 'errors'> & {
  errors?: z.ZodError<EditProductFormValues>['formErrors']['fieldErrors'];
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

export const AddVendedorFormSchema = z.object({
  name: z.string().min(1, 'El nombre del vendedor es requerido.'),
  contact: z.object({
    email: z.string().email('Email inválido.'),
    phone: z.string().min(1, 'El teléfono es requerido.'),
  }),
});

export type AddVendedorFormValues = z.infer<typeof AddVendedorFormSchema>;

export type AddVendedorFormState = {
  message: string;
  errors?: {
    _form?: string[];
    name?: string[];
    contact?: {
      email?: string[];
      phone?: string[];
    };
  };
  success: boolean;
};


export const CreateReservationFormSchema = z.object({
  vendedorId: z.string().min(1, 'Debe seleccionar un vendedor.'),
  platformId: z.string().min(1, 'Debe seleccionar una plataforma.'),
  customerEmail: z.string().email('Debe ingresar un correo de cliente válido.'),
  externalId: z.string().min(1, 'Debe ingresar un ID externo.'),
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1.'),
  variantId: z.string().optional(),
  variantSku: z.string().optional(),
});

export type CreateReservationFormValues = z.infer<typeof CreateReservationFormSchema>;

export type CreateReservationFormState = {
  message: string;
  errors?: {
    _form?: string[];
    vendedorId?: string[];
    platformId?: string[];
    customerEmail?: string[];
    externalId?: string[];
    quantity?: string[];
    variantId?: string[];
  };
  success: boolean;
};

// User Management Schemas
export const CreateUserFormSchema = z.object({
    name: z.string().min(1, 'Name is required.'),
    email: z.string().email('Invalid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
    role: z.enum(['admin', 'logistics', 'commercial', 'plataformas'], {
        required_error: 'Role is required.',
    }),
});

export type CreateUserFormValues = z.infer<typeof CreateUserFormSchema>;

export type CreateUserFormState = {
    message: string;
    errors?: z.ZodError<CreateUserFormValues>['formErrors']['fieldErrors'];
    success: boolean;
};

export const UpdateProfileFormSchema = z.object({
    name: z.string().min(1, 'Name is required.'),
    phone: z.string().optional(),
    avatar: z.any().optional(),
});

export type UpdateProfileFormValues = z.infer<typeof UpdateProfileFormSchema>;

export type UpdateProfileFormState = {
    message: string;
    errors?: z.ZodError<UpdateProfileFormValues>['formErrors']['fieldErrors'];
    success: boolean;
};

// Import Products Schemas
export const ImportProductSchema = z.object({
    name: z.string({ required_error: "La columna 'name' es obligatoria." }).min(1, "La columna 'name' no puede estar vacía."),
    sku: z.coerce.string({ required_error: "La columna 'sku' es obligatoria." }).min(1, "La columna 'sku' no puede estar vacía."),
    description: z.string({ required_error: "La columna 'description' es obligatoria." }).min(1, "La columna 'description' no puede estar vacía."),
    pricedropshipping: z.coerce.number({ required_error: "La columna 'pricedropshipping' es obligatoria.", invalid_type_error: 'El precio debe ser un número.' }).min(0, 'El precio debe ser un número no negativo.'),
    pricewholesale: z.coerce.number({ invalid_type_error: 'El precio mayorista debe ser un número.' }).min(0, 'El precio mayorista debe ser un número no negativo.').optional().nullable(),
    cost: z.coerce.number({ invalid_type_error: 'El costo debe ser un número.' }).min(0, 'El costo debe ser un número no negativo.').optional().nullable(),
    stock: z.coerce.number({ required_error: "La columna 'stock' es obligatoria.", invalid_type_error: 'El stock debe ser un número.' }).int('El stock debe ser un número entero.').min(0, 'El stock debe ser un número no negativo.'),
    categoryid: z.string({ required_error: "La columna 'categoryid' es obligatoria." }).min(1, "La columna 'categoryid' no puede estar vacía."),
    vendorid: z.string({ required_error: "La columna 'vendorid' es obligatoria." }).min(1, "La columna 'vendorid' no puede estar vacía."),
    purchasedate: z.date({ invalid_type_error: 'Formato de fecha inválido. Asegúrese de que esté en formato YYYY-MM-DD.'}).nullable().optional(),
});


export type ImportProductsFormState = {
    message: string;
    errors?: string;
    success: boolean;
    count: number;
};
    

    

    




      

    

    

  


    