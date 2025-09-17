

"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getProducts, updateProductStock, addInventoryMovement, getCarriers, getPlatforms, getInventoryMovementsByDate, createDispatchOrder, registerDamagedProduct } from '@/lib/api';
import type { Product, Carrier, Platform, DispatchOrderProduct, ProductVariant } from '@/lib/types';
import { Barcode, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { generatePickingListPDF } from '@/lib/pdf';
import { formatToTimeZone, cn } from '@/lib/utils';


interface DispatchedProduct extends Product {
    dispatchQuantity: number;
}

interface ReceivedProduct extends Product {
    receiveQuantity: number;
}

interface ReturnedProduct extends Product {
    trackingNumber: string;
}

// Represents a product or variant in one of the logistics lists
interface LogisticItem {
    productId: string; // Always the parent product ID
    variantId?: string; // The variant's own ID
    name: string; // Can be product or variant name
    sku: string;
    imageUrl: string;
    quantity: number;
}


type SearchContext = 'salidas' | 'entradas' | 'averias' | 'devoluciones';


export default function LogisticsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [allProductsList, setAllProductsList] = useState<Product[]>([]);
    const [carriers, setCarriers] = useState<Carrier[]>([]);
    const [platforms, setPlatforms] = useState<Platform[]>([]);


    // Salidas State
    const [platform, setPlatform] = useState('');
    const [carrier, setCarrier] = useState('');
    const [dispatchedProducts, setDispatchedProducts] = useState<LogisticItem[]>([]);
    const barcodeRef = useRef<HTMLInputElement>(null);
    const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchContext, setSearchContext] = useState<SearchContext>('salidas');
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [productToConfirm, setProductToConfirm] = useState<Product | null>(null);

    // Entradas State
    const [receivedProducts, setReceivedProducts] = useState<LogisticItem[]>([]);
    const entryBarcodeRef = useRef<HTMLInputElement>(null);
    
    // Devoluciones State
    const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
    const [returnCarrier, setReturnCarrier] = useState('');
    const [returnedProducts, setReturnedProducts] = useState<(LogisticItem & {trackingNumber: string})[]>([]);
    const [currentTrackingNumber, setCurrentTrackingNumber] = useState('');
    const [productToAdd, setProductToAdd] = useState<(Product | ProductVariant) & { parentId?: string, parentImageUrl?: string } | null>(null);
    const returnBarcodeRef = useRef<HTMLInputElement>(null);

    // Averías State
    const [damagedSku, setDamagedSku] = useState('');
    const [damageDescription, setDamageDescription] = useState('');
    const [damageCarrier, setDamageCarrier] = useState('');
    const [damageTrackingNumber, setDamageTrackingNumber] = useState('');

    // Variant Selection State
    const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
    const [productForVariantSelection, setProductForVariantSelection] = useState<Product | null>(null);


    useEffect(() => {
        if (user && user.role !== 'logistics' && user.role !== 'admin') {
          router.push('/');
        }
    }, [user, router]);

    useEffect(() => {
        async function fetchData() {
            const [products, fetchedCarriers, fetchedPlatforms] = await Promise.all([
                getProducts(),
                getCarriers(),
                getPlatforms(),
            ]);
            setAllProductsList(products);
            setCarriers(fetchedCarriers);
            setPlatforms(fetchedPlatforms);
        }
        fetchData();
    }, []);

    // --- GENERIC PRODUCT/VARIANT ADDITION ---

    const addProductOrVariant = (
        item: (Product | ProductVariant) & { parentId?: string, parentImageUrl?: string },
        context: SearchContext
    ) => {
        const parentId = 'parentId' in item ? item.parentId : item.id;
        const parentProduct = allProductsList.find(p => p.id === parentId);
        
        if (!parentProduct) {
            toast({ variant: 'destructive', title: 'Error', description: 'Producto padre no encontrado.' });
            return;
        }
    
        const logisticItem: LogisticItem = {
            productId: parentId, // Use parent product ID
            variantId: 'productType' in item ? undefined : item.id, // Only variants have variantId
            name: item.name,
            sku: item.sku || '',
            imageUrl: item.parentImageUrl || ('imageUrl' in item ? item.imageUrl : parentProduct.imageUrl),
            quantity: 1 // Default quantity
        };
    
        switch (context) {
            case 'salidas':
                setDispatchedProducts(prev => {
                    const existing = prev.find(p => p.sku === logisticItem.sku);
                    if (existing) {
                        return prev.map(p => p.sku === logisticItem.sku ? { ...p, quantity: p.quantity + 1 } : p);
                    }
                    return [...prev, logisticItem];
                });
                toast({ title: "Producto Agregado", description: `${logisticItem.name} añadido al despacho.` });
                break;
            case 'entradas':
                setReceivedProducts(prev => {
                    const existing = prev.find(p => p.sku === logisticItem.sku);
                    if (existing) {
                        return prev.map(p => p.sku === logisticItem.sku ? { ...p, quantity: p.quantity + 1 } : p);
                    }
                    return [...prev, logisticItem];
                });
                toast({ title: 'Producto Agregado', description: `${logisticItem.name} añadido a la recepción.` });
                break;
            case 'devoluciones':
                setProductToAdd(item);
                setIsReturnDialogOpen(true);
                break;
            case 'averias':
                setDamagedSku(logisticItem.sku || '');
                break;
        }
    };
    
    // --- SALIDAS ---

    const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const barcode = e.currentTarget.value;
          const simpleProduct = allProductsList.find(p => p.productType === 'simple' && p.sku === barcode);
          if (simpleProduct) {
              addProductOrVariant(simpleProduct, 'salidas');
          } else {
            const parentProduct = allProductsList.find(p => p.productType === 'variable' && p.variants?.some(v => v.sku === barcode));
            if (parentProduct) {
                const variant = parentProduct.variants?.find(v => v.sku === barcode);
                if (variant) {
                    addProductOrVariant({ ...variant, parentId: parentProduct.id, parentImageUrl: parentProduct.imageUrl }, 'salidas');
                } else {
                     toast({ variant: 'destructive', title: "Error", description: "SKU de variante no encontrado para producto variable." });
                }
            } else {
                 toast({ variant: 'destructive', title: "Error", description: "Producto no encontrado." });
            }
          }
          if(barcodeRef.current) barcodeRef.current.value = '';
        }
    };

    const openSearchDialog = (context: SearchContext) => {
        setSearchContext(context);
        setIsSearchDialogOpen(true);
    };

    const handleProductSearchSelect = (product: Product) => {
        setIsSearchDialogOpen(false);
        setSearchQuery('');

        if (product.productType === 'variable') {
            setProductForVariantSelection(product);
            setIsVariantDialogOpen(true);
        } else {
             if (searchContext === 'salidas') {
                setProductToConfirm(product);
                setTimeout(() => setIsConfirmDialogOpen(true), 150);
            } else {
                addProductOrVariant(product, searchContext);
            }
        }
    };

    const handleVariantSelect = (variant: ProductVariant) => {
        setIsVariantDialogOpen(false);
        if (productForVariantSelection) {
            addProductOrVariant({ ...variant, parentId: productForVariantSelection.id, parentImageUrl: productForVariantSelection.imageUrl }, searchContext);
        }
        setProductForVariantSelection(null);
    }

    const handleConfirmAddProduct = () => {
        if (productToConfirm) {
            addProductOrVariant(productToConfirm, 'salidas');
        }
        setIsConfirmDialogOpen(false);
        setProductToConfirm(null);
    };

    const filteredProducts = useMemo(() => {
        if (!searchQuery) return allProductsList;
        return allProductsList.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, allProductsList]);


    const handleRemoveProduct = (sku: string) => {
        setDispatchedProducts(prev => prev.filter(p => p.sku !== sku));
    };

    const handleDispatchQuantityChange = (sku: string, quantity: number) => {
        if (quantity >= 0) {
            setDispatchedProducts(prev => 
                prev.map(p => p.sku === sku ? { ...p, quantity: quantity } : p)
            );
        }
    };

    const handleCreateDispatch = async () => {
        if (!platform || !carrier || dispatchedProducts.length === 0) {
            toast({
              variant: 'destructive',
              title: "Faltan datos",
              description: "Por favor, selecciona plataforma, transportadora y agrega productos.",
            });
            return;
        }
        
        const today = new Date();
        const movementsToday = await getInventoryMovementsByDate(today);
        const dispatchMovementsToday = movementsToday.filter(m => m.type === 'Salida' && m.notes.includes('Dispatch ID:'));
        
        const existingDispatchIds = dispatchMovementsToday.map(m => {
            const match = m.notes.match(/Dispatch ID: (.*?)\./);
            return match ? match[1] : '';
        });

        let nextId = 1;
        if (existingDispatchIds.length > 0) {
            const maxId = Math.max(...existingDispatchIds.map(id => parseInt(id.split(' - ')[0], 10) || 0));
            nextId = maxId + 1;
        }
        
        const consecutiveId = nextId.toString().padStart(3, '0');
        const platformName = platforms.find(p => p.id === platform)?.name || 'N/A';
        const carrierName = carriers.find(c => c.id === carrier)?.name || 'N/A';
        const formattedDate = formatToTimeZone(today, 'dd/MM/yy');

        const dispatchId = `${consecutiveId} - ${platformName} - ${carrierName} - ${formattedDate}`;

        const productsForDispatch: DispatchOrderProduct[] = dispatchedProducts.map(p => ({
            productId: p.productId,
            variantId: p.variantId,
            sku: p.sku,
            name: p.name,
            quantity: p.quantity
        }));

        try {
            await createDispatchOrder({
                dispatchId,
                platformId: platform,
                carrierId: carrier,
                products: productsForDispatch
            });

            const pdfProducts = dispatchedProducts.map(p => ({
                sku: p.sku,
                name: p.name,
                dispatchQuantity: p.quantity,
            }))
            
            generatePickingListPDF(dispatchId, pdfProducts, platformName, carrierName);
    
            toast({
                title: "Salida Creada y PDF Generado",
                description: `Se ha creado una salida con ${dispatchedProducts.reduce((acc, p) => acc + p.quantity, 0)} unidades. El stock ha sido actualizado.`
            });
    
            setPlatform('');
            setCarrier('');
            setDispatchedProducts([]);
            router.refresh();

        } catch (error) {
            console.error("Failed to create dispatch:", error);
            const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado';
            toast({
                variant: 'destructive',
                title: 'Error al Crear Despacho',
                description: errorMessage,
            })
        }
    }

    // --- ENTRADAS ---
    const handleEntryBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const barcode = e.currentTarget.value;
            const simpleProduct = allProductsList.find(p => p.productType === 'simple' && p.sku === barcode);
            if (simpleProduct) {
                addProductOrVariant(simpleProduct, 'entradas');
            } else {
                const parentProduct = allProductsList.find(p => p.productType === 'variable' && p.variants?.some(v => v.sku === barcode));
                if (parentProduct) {
                    const variant = parentProduct.variants?.find(v => v.sku === barcode);
                    if (variant) {
                        addProductOrVariant({ ...variant, parentId: parentProduct.id, parentImageUrl: parentProduct.imageUrl }, 'entradas');
                    } else {
                        toast({ variant: 'destructive', title: "Error", description: "SKU de variante no encontrado para producto variable." });
                    }
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: 'Producto no encontrado.' });
                }
            }
            if (entryBarcodeRef.current) entryBarcodeRef.current.value = '';
        }
    };
    
    const handleReceivedQuantityChange = (sku: string, quantity: number) => {
        if (quantity >= 0) {
            setReceivedProducts(prev => prev.map(p => p.sku === sku ? { ...p, quantity: quantity } : p));
        }
    };

    const handleRemoveReceivedProduct = (sku: string) => {
        setReceivedProducts(prev => prev.filter(p => p.sku !== sku));
    };

    const handleRegisterEntry = async () => {
        if (receivedProducts.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'No hay productos para registrar.' });
            return;
        }

        const promises = receivedProducts.map(product => {
            if(product.quantity > 0) {
                updateProductStock(product.productId, product.quantity, 'add', product.sku);
                return addInventoryMovement({
                    type: 'Entrada',
                    productId: product.productId,
                    productName: product.name,
                    quantity: product.quantity,
                    notes: 'Recepción de mercancía de proveedor.'
                });
            }
        });
        
        await Promise.all(promises);

        toast({ title: 'Entrada Registrada', description: 'El stock ha sido actualizado correctamente.' });
        setReceivedProducts([]);
        router.refresh();
    };

    // --- DEVOLUCIONES ---
    const handleReturnBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const barcode = e.currentTarget.value;
            const simpleProduct = allProductsList.find(p => p.productType === 'simple' && p.sku === barcode);

            if (simpleProduct) {
                setProductToAdd(simpleProduct);
                setIsReturnDialogOpen(true);
            } else {
                const parentProduct = allProductsList.find(p => p.productType === 'variable' && p.variants?.some(v => v.sku === barcode));
                if (parentProduct) {
                    const variant = parentProduct.variants?.find(v => v.sku === barcode);
                    if (variant) {
                        setProductToAdd({ ...variant, parentId: parentProduct.id, parentImageUrl: parentProduct.imageUrl });
                        setIsReturnDialogOpen(true);
                    } else {
                         toast({ variant: 'destructive', title: "Error", description: "SKU de variante no encontrado." });
                    }
                } else {
                    toast({ variant: 'destructive', title: "Error", description: "Producto no encontrado." });
                }
            }
            if(returnBarcodeRef.current) returnBarcodeRef.current.value = '';
        }
    };
    
    const handleAddProductToReturn = () => {
        if (productToAdd && currentTrackingNumber) {
            const parentId = productToAdd.parentId || (productToAdd as Product).id;
            const parentProduct = allProductsList.find(p => p.id === parentId);

            const logisticItem: LogisticItem & { trackingNumber: string } = {
                productId: parentId,
                variantId: 'productType' in productToAdd ? undefined : productToAdd.id,
                name: productToAdd.name,
                sku: productToAdd.sku || '',
                imageUrl: productToAdd.parentImageUrl || parentProduct!.imageUrl,
                quantity: 1,
                trackingNumber: currentTrackingNumber,
            };

            setReturnedProducts(prev => [...prev, logisticItem]);
            toast({ title: "Producto Agregado", description: `${productToAdd.name} añadido a la devolución.` });
            
            setIsReturnDialogOpen(false);
            setProductToAdd(null);
            setCurrentTrackingNumber('');
            returnBarcodeRef.current?.focus();
        } else {
            toast({ variant: 'destructive', title: "Error", description: "Por favor, ingresa un número de guía." });
        }
    };
    
    const handleAddProductKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddProductToReturn();
        }
    };

    const handleRemoveReturnedProduct = (index: number) => {
        setReturnedProducts(prev => prev.filter((_, i) => i !== index));
    };

    const handleProcessReturn = async () => {
        if (!returnCarrier || returnedProducts.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Faltan datos',
                description: 'Por favor, selecciona una transportadora y agrega productos a la devolución.'
            });
            return;
        }
    
        const carrierName = carriers.find(c => c.id === returnCarrier)?.name || '';
    
        const promises = returnedProducts.map(product => {
            updateProductStock(product.productId, 1, 'add', product.sku);
            return addInventoryMovement({
                type: 'Entrada',
                productId: product.productId,
                productName: product.name,
                quantity: 1,
                notes: `Devolución de cliente. Guía: ${product.trackingNumber}. SKU: ${product.sku}`,
                carrierId: returnCarrier
            });
        });
    
        await Promise.all(promises);
        
        toast({
            title: 'Devolución Procesada',
            description: `Se ha procesado una devolución con ${returnedProducts.length} producto(s). El stock ha sido actualizado.`
        });
        
        setReturnCarrier('');
        setReturnedProducts([]);
        router.refresh();
    };

    // --- AVERÍAS ---
    const handleRegisterDamage = async () => {
        if (!damagedSku || !damageDescription || !damageCarrier || !damageTrackingNumber) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor completa todos los campos.' });
            return;
        }

        let productId: string | undefined;
        let finalSku: string | undefined;
        const lowercasedSku = damagedSku.toLowerCase();

        // Find product or variant by SKU
        const simpleProduct = allProductsList.find(p => p.productType === 'simple' && p.sku?.toLowerCase() === lowercasedSku);

        if (simpleProduct) {
            productId = simpleProduct.id;
            finalSku = simpleProduct.sku;
        } else {
            const parentProduct = allProductsList.find(p => 
                p.productType === 'variable' && p.variants?.some(v => v.sku.toLowerCase() === lowercasedSku)
            );
            if (parentProduct) {
                const variant = parentProduct.variants?.find(v => v.sku.toLowerCase() === lowercasedSku);
                if (variant) {
                    productId = parentProduct.id;
                    finalSku = variant.sku;
                }
            }
        }

        if (!productId || !finalSku) {
            toast({ variant: 'destructive', title: 'Error', description: 'SKU del producto no encontrado.' });
            return;
        }

        try {
            await registerDamagedProduct(
                productId,
                1,
                finalSku,
                damageCarrier,
                damageTrackingNumber,
                damageDescription
            );
    
            toast({ title: 'Avería Registrada', description: `Se ha registrado una avería para el SKU ${damagedSku}.` });
            setDamagedSku('');
            setDamageDescription('');
            setDamageCarrier('');
            setDamageTrackingNumber('');
            router.refresh();
        } catch (error) {
            console.error("Failed to register damage:", error);
            const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado';
            toast({
                variant: 'destructive',
                title: 'Error al Registrar Avería',
                description: errorMessage,
            });
        }
    };


    if (user?.role !== 'logistics' && user?.role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>
            </div>
        );
    }
    
    return (
    <>
        <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Producto</AlertDialogTitle>
                <AlertDialogDescription>
                    ¿Deseas añadir el siguiente producto al despacho?
                </AlertDialogDescription>
                </AlertDialogHeader>
                {productToConfirm && (
                    <div className="flex flex-col items-center justify-center gap-4 my-4">
                         <Image
                            src={productToConfirm.imageUrl}
                            alt={productToConfirm.name}
                            width={128}
                            height={128}
                            className="rounded-md object-cover"
                        />
                        <div className="text-center">
                            <p className="font-semibold">{productToConfirm.name}</p>
                            <p className="text-sm text-muted-foreground">SKU: {productToConfirm.sku}</p>
                        </div>
                    </div>
                )}
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setProductToConfirm(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmAddProduct}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isReturnDialogOpen} onOpenChange={(open) => {
            setIsReturnDialogOpen(open);
            if (!open) {
                setProductToAdd(null);
                setCurrentTrackingNumber('');
            }
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Añadir Producto a Devolución</DialogTitle>
                    <DialogDescription>
                       Ingresa el número de guía para el producto <span className="font-semibold">{productToAdd?.name}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="space-y-2">
                        <Label htmlFor="tracking-number">Número de Guía</Label>
                        <Input
                            id="tracking-number"
                            value={currentTrackingNumber}
                            onChange={(e) => setCurrentTrackingNumber(e.target.value)}
                            placeholder="Ej: TRK123456789"
                            onKeyDown={handleAddProductKeyDown}
                            autoFocus
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Cancelar
                        </Button>
                    </DialogClose>
                    <Button onClick={handleAddProductToReturn}>Agregar a Devolución</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Buscar Producto</DialogTitle>
                    <DialogDescription>
                        Busca un producto por nombre o SKU.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Input 
                        placeholder="Buscar por nombre o SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                    <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.map(product => (
                                        <TableRow 
                                            key={product.id}
                                            onClick={() => handleProductSearchSelect(product)}
                                            className="cursor-pointer hover:bg-muted"
                                        >
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell>{product.sku}</TableCell>
                                            <TableCell className="text-right">{product.stock}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center">No se encontraron productos.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
        
        <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
             <DialogContent>
                <DialogHeader>
                    <DialogTitle>Seleccionar Variante</DialogTitle>
                    <DialogDescription>
                        El producto <span className="font-semibold">{productForVariantSelection?.name}</span> es variable. Por favor, selecciona una variante.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[400px] overflow-y-auto py-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Variante</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {productForVariantSelection?.variants?.map(variant => (
                                <TableRow 
                                    key={variant.id}
                                    onClick={() => handleVariantSelect(variant)}
                                    className="cursor-pointer hover:bg-muted"
                                >
                                    <TableCell className="font-medium">{variant.name}</TableCell>
                                    <TableCell>{variant.sku}</TableCell>
                                    <TableCell className="text-right">{variant.stock}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
             </DialogContent>
        </Dialog>

        <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Panel de Logística</h1>
              <p className="text-muted-foreground">Gestiona las entradas, salidas y devoluciones de inventario.</p>
            </div>

            <Tabs defaultValue="salidas" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="salidas">Salidas</TabsTrigger>
                    <TabsTrigger value="entradas">Entradas</TabsTrigger>
                    <TabsTrigger value="devoluciones">Devoluciones</TabsTrigger>
                </TabsList>

                <TabsContent value="salidas">
                    <Card>
                        <CardHeader>
                            <CardTitle>Crear Salida de Pedido</CardTitle>
                            <CardDescription>Selecciona la plataforma, transportadora y agrega los productos a despachar.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="platform">Plataforma</Label>
                                    <Select value={platform} onValueChange={setPlatform}>
                                        <SelectTrigger id="platform">
                                        <SelectValue placeholder="Seleccionar una plataforma" />
                                        </SelectTrigger>
                                        <SelectContent>
                                        {platforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="carrier">Transportadora</Label>
                                    <Select value={carrier} onValueChange={setCarrier}>
                                        <SelectTrigger id="carrier">
                                        <SelectValue placeholder="Seleccionar una transportadora" />
                                        </SelectTrigger>
                                        <SelectContent>
                                        {carriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="barcode-salida">Escanear Código de Barras (SKU)</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-grow">
                                        <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            id="barcode-salida"
                                            ref={barcodeRef}
                                            placeholder="Escanear SKU y presionar Enter" 
                                            className="pl-8"
                                            onKeyDown={handleBarcodeScan}
                                        />
                                    </div>
                                    <Button variant="outline" size="icon" onClick={() => openSearchDialog('salidas')}>
                                        <Search className="h-4 w-4" />
                                        <span className="sr-only">Buscar Producto</span>
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">Usa el SKU del producto (ej: WM-ERGO-01) como código de barras o usa el buscador.</p>
                            </div>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Productos a Despachar</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[80px]">Imagen</TableHead>
                                                <TableHead>Producto</TableHead>
                                                <TableHead>SKU</TableHead>
                                                <TableHead className="text-center w-[150px]">Cantidad</TableHead>
                                                <TableHead className="text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                        {dispatchedProducts.length > 0 ? (
                                            dispatchedProducts.map(product => (
                                            <TableRow key={product.sku}>
                                                <TableCell>
                                                    <Image
                                                        src={product.imageUrl}
                                                        alt={product.name}
                                                        width={64}
                                                        height={64}
                                                        className="rounded-md object-cover"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{product.name}</TableCell>
                                                <TableCell>{product.sku}</TableCell>
                                                <TableCell className="text-center">
                                                    <Input 
                                                        type="number"
                                                        className="w-24 text-center mx-auto"
                                                        value={product.quantity}
                                                        onChange={(e) => handleDispatchQuantityChange(product.sku, parseInt(e.target.value, 10))}
                                                        min="1"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveProduct(product.sku)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                            <TableCell colSpan={5} className="text-center">Aún no hay productos en el despacho.</TableCell>
                                            </TableRow>
                                        )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleCreateDispatch}>Crear Salida</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="entradas">
                    <Card>
                        <CardHeader>
                            <CardTitle>Registrar Entrada de Mercancía</CardTitle>
                            <CardDescription>Añade productos al inventario al recibirlos del proveedor.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="barcode-entrada">Escanear o Buscar Producto</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-grow">
                                        <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            id="barcode-entrada"
                                            ref={entryBarcodeRef}
                                            placeholder="Escanear SKU para agregar producto" 
                                            className="pl-8"
                                            onKeyDown={handleEntryBarcodeScan}
                                        />
                                    </div>
                                    <Button variant="outline" size="icon" onClick={() => openSearchDialog('entradas')}>
                                        <Search className="h-4 w-4" />
                                        <span className="sr-only">Buscar Producto</span>
                                    </Button>
                                </div>
                            </div>
                             <Card>
                                <CardHeader><CardTitle>Productos Recibidos</CardTitle></CardHeader>
                                <CardContent>
                                     <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[80px]">Imagen</TableHead>
                                                <TableHead>Producto</TableHead>
                                                <TableHead>SKU</TableHead>
                                                <TableHead className="text-center w-[150px]">Cantidad</TableHead>
                                                <TableHead className="text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {receivedProducts.length > 0 ? (
                                                receivedProducts.map(product => (
                                                    <TableRow key={product.sku}>
                                                        <TableCell>
                                                            <Image
                                                                src={product.imageUrl}
                                                                alt={product.name}
                                                                width={64}
                                                                height={64}
                                                                className="rounded-md object-cover"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-medium">{product.name}</TableCell>
                                                        <TableCell>{product.sku}</TableCell>
                                                        <TableCell>
                                                            <Input 
                                                                type="number"
                                                                className="w-24 text-center mx-auto"
                                                                value={product.quantity}
                                                                onChange={(e) => handleReceivedQuantityChange(product.sku, parseInt(e.target.value, 10))}
                                                                min="0"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveReceivedProduct(product.sku)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center">Escanea o busca un producto para comenzar.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleRegisterEntry}>Registrar Entrada</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                <TabsContent value="devoluciones">
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="general">Devoluciones Generales</TabsTrigger>
                            <TabsTrigger value="averias">Averías</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Procesar Devolución</CardTitle>
                                    <CardDescription>Gestiona las devoluciones masivas de clientes.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div>
                                        <Label htmlFor="return-carrier">Transportadora</Label>
                                        <Select value={returnCarrier} onValueChange={setReturnCarrier}>
                                            <SelectTrigger id="return-carrier">
                                                <SelectValue placeholder="Seleccionar una transportadora" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {carriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                     <div>
                                        <Label htmlFor="return-barcode">Escanear o Buscar Producto</Label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-grow">
                                                <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input 
                                                    id="return-barcode"
                                                    ref={returnBarcodeRef}
                                                    placeholder="Escanear SKU para agregar producto" 
                                                    className="pl-8"
                                                    onKeyDown={handleReturnBarcodeScan}
                                                />
                                            </div>
                                            <Button variant="outline" size="icon" onClick={() => openSearchDialog('devoluciones')}>
                                                <Search className="h-4 w-4" />
                                                <span className="sr-only">Buscar Producto</span>
                                            </Button>
                                        </div>
                                    </div>
                                     <Card>
                                        <CardHeader><CardTitle>Productos a Devolver</CardTitle></CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Producto</TableHead>
                                                        <TableHead>SKU</TableHead>
                                                        <TableHead>Nº Guía</TableHead>
                                                        <TableHead className="text-right">Acciones</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {returnedProducts.length > 0 ? (
                                                        returnedProducts.map((p, index) => (
                                                            <TableRow key={`${p.sku}-${index}`}>
                                                                <TableCell className="font-medium">{p.name}</TableCell>
                                                                <TableCell>{p.sku}</TableCell>
                                                                <TableCell>{p.trackingNumber}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveReturnedProduct(index)}>
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center">Aún no hay productos en la devolución.</TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </CardContent>
                                <CardFooter>
                                    <Button onClick={handleProcessReturn}>Procesar Devolución</Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>
                        <TabsContent value="averias">
                             <Card>
                                <CardHeader>
                                    <CardTitle>Registrar Producto Averiado</CardTitle>
                                    <CardDescription>Registra productos que llegaron dañados o no son aptos para la venta.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="damage-carrier">Transportadora</Label>
                                            <Select value={damageCarrier} onValueChange={setDamageCarrier}>
                                                <SelectTrigger id="damage-carrier">
                                                    <SelectValue placeholder="Seleccionar transportadora" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {carriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor="damage-tracking-number">Número de Guía</Label>
                                            <Input
                                                id="damage-tracking-number"
                                                placeholder="Ej: TRK123456789"
                                                value={damageTrackingNumber}
                                                onChange={(e) => setDamageTrackingNumber(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                     <div>
                                        <Label htmlFor="damage-product-sku">SKU del Producto Averiado</Label>
                                        <div className="flex gap-2">
                                            <Input 
                                                id="damage-product-sku" 
                                                placeholder="Ej: WM-ERGO-01" 
                                                value={damagedSku}
                                                onChange={(e) => setDamagedSku(e.target.value)}
                                            />
                                             <Button variant="outline" size="icon" onClick={() => openSearchDialog('averias')}>
                                                <Search className="h-4 w-4" />
                                                <span className="sr-only">Buscar Producto</span>
                                            </Button>
                                        </div>
                                    </div>
                                    <div>
                                        <Label htmlFor="damage-description">Descripción del Daño</Label>
                                        <Textarea 
                                            id="damage-description"
                                            placeholder="Describe el daño o el problema del producto..." 
                                            value={damageDescription}
                                            onChange={(e) => setDamageDescription(e.target.value)}
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button variant="destructive" onClick={handleRegisterDamage}>Registrar Avería</Button>
                                </CardFooter>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </TabsContent>
            </Tabs>
        </div>
    </>
    );
}
