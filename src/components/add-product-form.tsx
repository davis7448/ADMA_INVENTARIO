
"use client";

import { useEffect, useState, useTransition, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
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
import { addProductAction } from '@/app/actions/products';
import { useToast } from '@/hooks/use-toast';
import type { AddProductFormValues } from '@/lib/definitions';
import { AddProductFormSchema } from '@/lib/definitions';
import type { Supplier, Category } from '@/lib/types';
import { CalendarIcon, Trash2, Upload, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';

interface AddProductFormProps {
  onProductAdded: () => void;
}

export function AddProductForm({ onProductAdded }: AddProductFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<AddProductFormValues>({
    resolver: zodResolver(AddProductFormSchema),
    defaultValues: {
      name: '',
      sku: '',
      description: '',
      productType: 'simple',
      categoryId: '',
      vendorId: '',
      priceDropshipping: undefined,
      priceWholesale: undefined,
      cost: undefined,
      purchaseDate: undefined,
      stock: undefined,
      image: undefined,
      contentLink: '',
      variants: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  const productType = form.watch('productType');
  const variants = form.watch('variants');

  useEffect(() => {
    if (productType === 'variable' && variants) {
        const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
        form.setValue('stock', totalStock, { shouldValidate: true });
    }
  }, [variants, productType, form]);


  useEffect(() => {
    if (open) {
        Promise.all([getSuppliers(), getCategories()]).then(([fetchedSuppliers, fetchedCategories]) => {
            setSuppliers(fetchedSuppliers);
            setCategories(fetchedCategories);
        });
    }
  }, [open]);

  // Camera Permission Effect
  useEffect(() => {
    if (isCameraOpen) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
        }
      };
      getCameraPermission();

      return () => {
        // Cleanup: stop video tracks when dialog closes
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  }, [isCameraOpen]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (context) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            
            const dataUrl = canvas.toDataURL('image/jpeg');
            setImagePreview(dataUrl);

            canvas.toBlob(blob => {
                if (blob) {
                    const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
                    form.setValue('image', file, { shouldValidate: true });
                }
            }, 'image/jpeg');

            setIsCameraOpen(false); // Close camera dialog after capture
        }
    }
  };


  const handleImport = () => {
    const lines = importText.trim().split('\n');
    const newVariants = lines.map(line => {
      const parts = line.split(/[\t,]/); // Split by tab or comma
      const [sku, name, priceDropshipping, priceWholesale, stock] = parts;
      return {
        id: uuidv4(),
        sku: sku?.trim() || '',
        name: name?.trim() || '',
        priceDropshipping: parseFloat(priceDropshipping?.trim()) || 0,
        priceWholesale: parseFloat(priceWholesale?.trim()) || 0,
        stock: parseInt(stock?.trim(), 10) || 0,
      };
    }).filter(v => v.name && v.sku); // Only add variants that have a name and sku

    replace(newVariants);
    toast({
      title: 'Importación Exitosa',
      description: `Se han importado ${newVariants.length} variantes.`,
    })
    setIsImporting(false);
    setImportText('');
  };


  const onSubmit = (values: AddProductFormValues) => {
    const formData = new FormData();
    
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'image' && value instanceof File) {
        formData.append(key, value);
      } else if (key === 'variants' && Array.isArray(value)) {
        value.forEach((variant, index) => {
          Object.entries(variant).forEach(([vKey, vValue]) => {
            formData.append(`variants[${index}].${vKey}`, String(vValue));
          });
        });
      } else if (key === 'purchaseDate' && value instanceof Date) {
        formData.append(key, value.toISOString());
      }
       else if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    startTransition(async () => {
        const result = await addProductAction(formData);

        if (result.success) {
            toast({
              title: 'Success!',
              description: result.message,
            });
            setOpen(false); 
            onProductAdded();
        } else {
            toast({
              title: 'Error',
              description: result.message || 'Something went wrong.',
              variant: 'destructive',
            });
            if (result.errors) {
                Object.entries(result.errors).forEach(([key, errorMessages]) => {
                  const fieldKey = key as keyof AddProductFormValues;
                  if (fieldKey && errorMessages) {
                    form.setError(fieldKey, {
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
    if (!open) {
      form.reset();
      setImagePreview(null);
    }
  }, [open, form]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>Add Product</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Enter the details of the new product below.
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
                                          value={productType === 'variable' ? '' : field.value}
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
                  <FormField
                      control={form.control}
                      name="image"
                      render={({ field: { onChange, value, ...rest } }) => (
                          <FormItem>
                              <FormLabel>Product Image</FormLabel>
                                <div className="flex items-center gap-4">
                                {imagePreview && (
                                    <Image src={imagePreview} alt="Product preview" width={80} height={80} className="rounded-md object-cover" />
                                )}
                                <div className="flex-1 space-y-2">
                                  <FormControl>
                                    <Input 
                                      type="file" 
                                      accept="image/png, image/jpeg, image/webp"
                                      onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            onChange(file);
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              setImagePreview(reader.result as string);
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                      }}
                                      {...rest}
                                    />
                                  </FormControl>
                                  <Button type="button" variant="outline" onClick={() => setIsCameraOpen(true)}>
                                      <Camera className="mr-2 h-4 w-4" />
                                      Take Photo
                                  </Button>
                                </div>
                              </div>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
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
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">Variants</h3>
                            <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsImporting(true)}
                                >
                                  <Upload className="mr-2 h-4 w-4" />
                                  Importar Variantes
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ id: uuidv4(), sku: '', name: '', priceDropshipping: 0, priceWholesale: 0, stock: 0 })}
                                >
                                    Add Variant
                                </Button>
                            </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-12 gap-2 items-start px-2">
                            <Label className="col-span-3">SKU</Label>
                            <Label className="col-span-3">Nombre</Label>
                            <Label className="col-span-2">P. Drop</Label>
                            <Label className="col-span-2">P. x Mayor</Label>
                            <Label className="col-span-1">Stock</Label>
                            <Label className="col-span-1 text-right">Acción</Label>
                        </div>
                        {fields.map((field, index) => (
                          <div key={field.id} className="grid grid-cols-12 gap-2 items-start p-2 border rounded-md">
                            <FormField
                              control={form.control}
                              name={`variants.${index}.sku`}
                              render={({ field }) => (
                                <FormItem className="col-span-3">
                                  <FormControl>
                                    <Input placeholder="SKU" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`variants.${index}.name`}
                              render={({ field }) => (
                                <FormItem className="col-span-3">
                                  <FormControl>
                                    <Input placeholder="Variant Name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`variants.${index}.priceDropshipping`}
                              render={({ field }) => (
                                <FormItem className="col-span-2">
                                  <FormControl>
                                    <Input type="number" placeholder="Price" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                             <FormField
                              control={form.control}
                              name={`variants.${index}.priceWholesale`}
                              render={({ field }) => (
                                <FormItem className="col-span-2">
                                  <FormControl>
                                    <Input type="number" placeholder="Price" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`variants.${index}.stock`}
                              render={({ field }) => (
                                <FormItem className="col-span-1">
                                  <FormControl>
                                    <Input type="number" placeholder="Stock" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="col-span-1 flex items-center justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {fields.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                Click 'Add Variant' to create product variations.
                            </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="priceDropshipping"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Precio Dropshipping</FormLabel>
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
                        name="priceWholesale"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Precio x Mayor</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        step="0.01" 
                                        placeholder="e.g., 69.99" 
                                        {...field} 
                                        value={productType === 'variable' ? '' : field.value ?? ''} 
                                        disabled={productType === 'variable'}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                          value={field.value ?? ''}
                                          onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} 
                                          disabled={productType === 'variable'}
                                          readOnly={productType === 'variable'}
                                      />
                                  </FormControl>
                                  <FormMessage />
                              </FormItem>
                          )}
                      />
                      {user?.role === 'admin' && (
                        <FormField
                            control={form.control}
                            name="cost"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Costo</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="e.g., 45.50" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                      )}
                      <FormField
                            control={form.control}
                            name="purchaseDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Purchase Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) =>
                                                    date > new Date() || date < new Date("1900-01-01")
                                                }
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
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
                          {isPending ? 'Adding Product...' : 'Add Product'}
                      </Button>
                  </DialogFooter>
              </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog open={isImporting} onOpenChange={setIsImporting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Variantes desde Texto</DialogTitle>
            <DialogDescription>
              Pega aquí los datos de tus variantes desde una hoja de cálculo (Excel, Google Sheets). 
              Usa una línea por variante y asegúrate de que las columnas estén en el orden: SKU, Nombre, Precio Dropshipping, Precio x Mayor, Stock.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Ejemplo:
CAM-01-R,Rojo,25.00,20.00,10
CAM-01-A,Azul,25.00,20.00,15
CAM-01-V,Verde,25.00,20.00,12"
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleImport}>Importar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       {/* Camera Dialog */}
       <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Take Photo</DialogTitle>
                    <DialogDescription>
                        Position the product in front of the camera and capture the image.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {hasCameraPermission === false ? (
                        <Alert variant="destructive">
                            <AlertTitle>Camera Access Denied</AlertTitle>
                            <AlertDescription>
                                Please enable camera permissions in your browser settings to use this feature.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div>
                            <video ref={videoRef} className="w-full aspect-video rounded-md" autoPlay muted />
                            <canvas ref={canvasRef} className="hidden" />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                    <Button onClick={handleCapture} disabled={hasCameraPermission !== true}>
                        Capture
                    </Button>
                </DialogFooter>
            </DialogContent>
      </Dialog>
    </>
  );
}
