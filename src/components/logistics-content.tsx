

"use client";

import { useState, useRef, useEffect, useMemo, useTransition } from 'react';
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
import { createDispatchOrder, getSuppliers, getEntryReasons, registerDamagedProduct } from '@/lib/api';
import type { Product, Carrier, Platform, DispatchOrderProduct, ProductVariant, LogisticItem, Supplier, EntryReason } from '@/lib/types';
import { Barcode, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
    DialogDescription
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
import { generatePickingListAction } from '@/app/actions/pdf';
import { cn } from '@/lib/utils';
import { registerInventoryEntryAction } from '@/app/actions/inventory';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';


type SearchContext = 'salidas' | 'entradas' | 'averias' | 'devoluciones' | 'ajustes';

interface LogisticsContentProps {
    initialProducts: Product[];
    initialCarriers: Carrier[];
    initialPlatforms: Platform[];
}

export function LogisticsContent({ initialProducts, initialCarriers, initialPlatforms }: LogisticsContentProps) {
    const { user, currentWarehouse, effectiveWarehouseId } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [allProductsList, setAllProductsList] = useState<Product[]>(initialProducts);
    const [carriers, setCarriers] = useState<Carrier[]>(initialCarriers);
    const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [entryReasons, setEntryReasons] = useState<EntryReason[]>([]);


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
    const [isDispatching, startDispatchTransition] = useTransition();

    // Entradas State
    const [receivedProducts, setReceivedProducts] = useState<LogisticItem[]>([]);
    const entryBarcodeRef = useRef<HTMLInputElement>(null);
    const [isEntryPending, startEntryTransition] = useTransition();
    const [entryReason, setEntryReason] = useState('reception');
    const [entrySupplier, setEntrySupplier] = useState('');

    // Ajustes State
    const [adjustmentProducts, setAdjustmentProducts] = useState<LogisticItem[]>([]);
    const adjustmentBarcodeRef = useRef<HTMLInputElement>(null);
    const [adjustmentType, setAdjustmentType] = useState<'in' | 'out'>('in');
    
    // Devoluciones State
    const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
    const [isReturnProcessing, startReturnTransition] = useTransition();
    const [returnCarrier, setReturnCarrier] = useState('');
    const [returnedProducts, setReturnedProducts] = useState<(LogisticItem & {trackingNumber: string})[]>([]);
    const [currentTrackingNumber, setCurrentTrackingNumber] = useState('');
    const [productToAdd, setProductToAdd] = useState<(Product | ProductVariant) & { parentId?: string, parentImageUrl?: string } | null>(null);
    const returnBarcodeRef = useRef<HTMLInputElement>(null);

    // Averías State
    const [damagedProduct, setDamagedProduct] = useState<(Product | (ProductVariant & { parentId?: string, parentImageUrl?: string })) | null>(null);
    const [damageDescription, setDamageDescription] = useState('');
    const [damageCarrier, setDamageCarrier] = useState('');
    const [damageTrackingNumber, setDamageTrackingNumber] = useState('');
    const [isDamageConfirmDialogOpen, setIsDamageConfirmDialogOpen] = useState(false);
    const [isDamageProcessing, startDamageTransition] = useTransition();


    // Variant Selection State
    const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
    const [productForVariantSelection, setProductForVariantSelection] = useState<Product | null>(null);

    useEffect(() => {
        getSuppliers().then(setSuppliers);
        getEntryReasons().then(setEntryReasons);
    }, []);

    // --- GENERIC PRODUCT/VARIANT ADDITION ---

    const addProductOrVariant = (
        item: (Product | ProductVariant) & { parentId?: string, parentImageUrl?: string },
        context: SearchContext
    ) => {
        const parentId = 'parentId' in item ? item.parentId! : item.id;
        const parentProduct = allProductsList.find(p => p.id === parentId);
        
        if (!parentProduct && context !== 'averias') {
            toast({ variant: 'destructive', title: 'Error', description: 'Producto padre no encontrado.' });
            return;
        }
    
        const logisticItem: LogisticItem = {
            productId: parentId, // Use parent product ID
            variantId: 'productType' in item ? undefined : item.id, // Only variants have variantId
            name: item.name,
            sku: item.sku || '',
            imageUrl: item.parentImageUrl || ('imageUrl' in item ? item.imageUrl : parentProduct?.imageUrl || ''),
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
            case 'ajustes':
                setAdjustmentProducts(prev => {
                    const existing = prev.find(p => p.sku === logisticItem.sku);
                    if (existing) {
                        return prev.map(p => p.sku === logisticItem.sku ? { ...p, quantity: p.quantity + 1 } : p);
                    }
                    return [...prev, logisticItem];
                });
                toast({ title: 'Producto Agregado', description: `${logisticItem.name} añadido al ajuste.` });
                break;
            case 'devoluciones':
                setProductToAdd(item);
                setIsReturnDialogOpen(true);
                break;
            case 'averias':
                setDamagedProduct(item);
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
            } else if (searchContext === 'averias') {
                setDamagedProduct(product);
                setTimeout(() => setIsDamageConfirmDialogOpen(true), 150);
            } else {
                addProductOrVariant(product, searchContext);
            }
        }
    };

    const handleVariantSelect = (variant: ProductVariant) => {
        setIsVariantDialogOpen(false);
        if (productForVariantSelection) {
            const variantWithContext = { ...variant, parentId: productForVariantSelection.id, parentImageUrl: productForVariantSelection.imageUrl };
            if (searchContext === 'averias') {
                setDamagedProduct(variantWithContext);
                setTimeout(() => setIsDamageConfirmDialogOpen(true), 150);
            } else {
                addProductOrVariant(variantWithContext, searchContext);
            }
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
        const lowercasedQuery = searchQuery.toLowerCase();
        return allProductsList.filter(p => {
            const nameMatch = p.name.toLowerCase().includes(lowercasedQuery);
            const skuMatch = p.sku && p.sku.toLowerCase().includes(lowercasedQuery);
            const variantMatch = p.productType === 'variable' && p.variants?.some(v => 
                v.name.toLowerCase().includes(lowercasedQuery) || 
                v.sku.toLowerCase().includes(lowercasedQuery)
            );
            return nameMatch || skuMatch || variantMatch;
        });
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

        // Validate stock availability
        const stockErrors: string[] = [];
        for (const item of dispatchedProducts) {
            const product = allProductsList.find(p => p.id === item.productId);
            if (!product) {
                stockErrors.push(`Producto ${item.name} no encontrado.`);
                continue;
            }

            let availableStock = 0;
            if (item.variantId && product.productType === 'variable') {
                const variant = product.variants?.find(v => v.id === item.variantId);
                if (variant) {
                    availableStock = variant.stock;
                } else {
                    stockErrors.push(`Variante de ${item.name} no encontrada.`);
                    continue;
                }
            } else {
                availableStock = product.stock;
            }

            if (availableStock < item.quantity) {
                stockErrors.push(`Producto: ${item.name}. Disponible: ${availableStock}, se piden: ${item.quantity}.`);
            }
        }

        if (stockErrors.length > 0) {
            toast({
                variant: 'destructive',
                title: "No hay suficiente inventario",
                description: stockErrors.join(' '),
            });
            return;
        }

        startDispatchTransition(async () => {
            const platformName = platforms.find(p => p.id === platform)?.name || 'N/A';
            const carrierName = carriers.find(c => c.id === carrier)?.name || 'N/A';
            
            const productsForDispatch: DispatchOrderProduct[] = dispatchedProducts.map(p => ({
                productId: p.productId,
                variantId: p.variantId,
                sku: p.sku,
                name: p.name,
                quantity: p.quantity
            }));

            try {
                const { dispatchId, date } = await createDispatchOrder({
                    platformId: platform,
                    carrierId: carrier,
                    products: productsForDispatch,
                    createdBy: user ? { id: user.id, name: user.name } : undefined,
                    warehouseId: effectiveWarehouseId || undefined
                });

                const pdfProducts = dispatchedProducts.map(p => ({
                    sku: p.sku,
                    name: p.name,
                    dispatchQuantity: p.quantity,
                }));
                
                const pdfResult = await generatePickingListAction(dispatchId, pdfProducts, platformName, carrierName, date as any);
                if (pdfResult.success && pdfResult.pdfData) {
                    const byteCharacters = atob(pdfResult.pdfData);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], {type: 'application/pdf'});
                    const link = document.createElement('a');
                    link.href = window.URL.createObjectURL(blob);
                    link.download = `picking-list-${dispatchId.replace(/\s/g, '-')}.pdf`;
                    link.click();
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Error al Generar PDF',
                        description: pdfResult.message || "No se pudo generar el PDF del picking list.",
                    });
                }
        
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
        });
    }

    // --- ENTRADAS / AJUSTES ---
    const handleEntryBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const barcode = e.currentTarget.value;
            const context = entryReason === 'adjustment' ? 'ajustes' : 'entradas';

            const simpleProduct = allProductsList.find(p => p.productType === 'simple' && p.sku === barcode);
            if (simpleProduct) {
                addProductOrVariant(simpleProduct, context);
            } else {
                const parentProduct = allProductsList.find(p => p.productType === 'variable' && p.variants?.some(v => v.sku === barcode));
                if (parentProduct) {
                    const variant = parentProduct.variants?.find(v => v.sku === barcode);
                    if (variant) {
                        addProductOrVariant({ ...variant, parentId: parentProduct.id, parentImageUrl: parentProduct.imageUrl }, context);
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
        if (entryReason === 'reception' && !entrySupplier) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona un proveedor.' });
            return;
        }

        startEntryTransition(async () => {
            const result = await registerInventoryEntryAction(receivedProducts, user, entryReason, entrySupplier, undefined, effectiveWarehouseId);
            if (result.success) {
                toast({
                    title: '¡Éxito!',
                    description: `Se registraron ${result.count} entradas de productos.`,
                });
                setReceivedProducts([]);
                setEntryReason('reception');
                setEntrySupplier('');
                router.refresh();
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error al Registrar Entrada',
                    description: result.message,
                });
            }
        });
    };

    const handleAdjustmentQuantityChange = (sku: string, quantity: number) => {
        if (quantity >= 0) {
            setAdjustmentProducts(prev => prev.map(p => p.sku === sku ? { ...p, quantity: quantity } : p));
        }
    };

    const handleRemoveAdjustmentProduct = (sku: string) => {
        setAdjustmentProducts(prev => prev.filter(p => p.sku !== sku));
    };

    const handleRegisterAdjustment = async () => {
        if (adjustmentProducts.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'No hay productos para ajustar.' });
            return;
        }

        // Check if any products have been audited
        const auditedProducts = adjustmentProducts.filter(item => {
            const product = allProductsList.find(p => p.id === item.productId);
            return product && product.lastAuditedAt;
        });

        if (auditedProducts.length > 0) {
            const auditedNames = auditedProducts.map(p => p.name).join(', ');
            toast({
                variant: 'destructive',
                title: 'Ajuste No Permitido',
                description: `Los siguientes productos ya han sido auditados y no se pueden ajustar: ${auditedNames}.`,
            });
            return;
        }

        const reasonLabel = adjustmentType === 'in' ? 'Ajuste de Entrada' : 'Ajuste de Salida';

        startEntryTransition(async () => {
            const result = await registerInventoryEntryAction(adjustmentProducts, user, reasonLabel, undefined, undefined, effectiveWarehouseId);
            if (result.success) {
                toast({
                    title: '¡Éxito!',
                    description: `Se registró el ajuste para ${result.count} productos.`,
                });
                setAdjustmentProducts([]);
                router.refresh();
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error al Registrar Ajuste',
                    description: result.message,
                });
            }
        });
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
                imageUrl: productToAdd.parentImageUrl || (parentProduct ? parentProduct.imageUrl : ''),
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
        
        startReturnTransition(async () => {
            const result = await registerInventoryEntryAction(returnedProducts, user, 'Devolución de Cliente', undefined, returnCarrier, effectiveWarehouseId);
            if (result.success) {
                toast({
                    title: '¡Devolución Procesada!',
                    description: `Se han procesado ${result.count} productos. El stock ha sido restaurado.`
                });
                setReturnCarrier('');
                setReturnedProducts([]);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error al Procesar Devolución',
                    description: result.message
                });
            }
        });
    };

    // --- AVERÍAS ---
    const handleConfirmDamageProduct = () => {
        setIsDamageConfirmDialogOpen(false);
        // The damagedProduct state is already set, we just close the dialog
    };

    const handleRegisterDamage = async () => {
        if (!damagedProduct || !damageDescription || !damageCarrier || !damageTrackingNumber) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor completa todos los campos, incluido el producto.' });
            return;
        }

        startDamageTransition(async () => {
            try {
                const parentId = 'parentId' in damagedProduct ? damagedProduct.parentId! : damagedProduct.id;
                await registerDamagedProduct(
                    parentId,
                    1, // For now, we handle one damaged product at a time from this UI
                    damagedProduct.sku!,
                    damageCarrier,
                    damageTrackingNumber,
                    damageDescription,
                    user
                );
                toast({ title: 'Avería Registrada', description: `Se ha registrado una avería para el SKU ${damagedProduct.sku}. El stock ha sido actualizado.` });
                setDamagedProduct(null);
                setDamageDescription('');
                setDamageCarrier('');
                setDamageTrackingNumber('');
                router.refresh();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado';
                toast({ variant: 'destructive', title: 'Error al Registrar Avería', description: errorMessage });
            }
        });
    };

    const canManageEntries = user?.role === 'admin' || user?.role === 'plataformas' || user?.role === 'logistics';
    
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

        <AlertDialog open={isDamageConfirmDialogOpen} onOpenChange={setIsDamageConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Producto para Avería</AlertDialogTitle>
                    <AlertDialogDescription>
                        Se usará el SKU de este producto en el formulario de avería.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {damagedProduct && (
                    <div className="flex flex-col items-center justify-center gap-4 my-4">
                        <Image
                            src={'parentImageUrl' in damagedProduct ? damagedProduct.parentImageUrl || '' : (damagedProduct as Product).imageUrl}
                            alt={damagedProduct.name}
                            width={128}
                            height={128}
                            className="rounded-md object-cover"
                        />
                        <div className="text-center">
                            <p className="font-semibold">{damagedProduct.name}</p>
                            <p className="text-sm text-muted-foreground">SKU: {damagedProduct.sku}</p>
                        </div>
                    </div>
                )}
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDamagedProduct(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDamageProduct}>Confirmar</AlertDialogAction>
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
                <TabsList className={cn("grid w-full", canManageEntries ? "grid-cols-4" : "grid-cols-2")}>
                    <TabsTrigger value="salidas">Salidas</TabsTrigger>
                    {canManageEntries && <TabsTrigger value="entradas">Recepción</TabsTrigger>}
                    {canManageEntries && <TabsTrigger value="ajustes">Ajustes</TabsTrigger>}
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
                            <Button onClick={handleCreateDispatch} disabled={isDispatching}>
                                {isDispatching ? 'Creando...' : 'Crear Salida'}
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {canManageEntries && (
                    <TabsContent value="entradas">
                        <Card>
                            <CardHeader>
                                <CardTitle>Recepción de Mercancía de Proveedor</CardTitle>
                                <CardDescription>Añade productos al inventario al recibirlos del proveedor.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label htmlFor="entry-supplier">Proveedor</Label>
                                    <Select value={entrySupplier} onValueChange={setEntrySupplier}>
                                        <SelectTrigger id="entry-supplier">
                                        <SelectValue placeholder="Seleccionar un proveedor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
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
                                                onKeyDown={(e) => handleEntryBarcodeScan(e)}
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
                                <Button onClick={handleRegisterEntry} disabled={isEntryPending}>
                                    {isEntryPending ? 'Registrando...' : 'Registrar Recepción'}
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                )}

                 {canManageEntries && (
                    <TabsContent value="ajustes">
                        <Card>
                            <CardHeader>
                                <CardTitle>Ajuste Manual de Inventario</CardTitle>
                                <CardDescription>Aumenta o disminuye el stock de productos por razones específicas (ej: conteo físico, merma no relacionada a devolución).</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label>Tipo de Ajuste</Label>
                                    <RadioGroup defaultValue="in" value={adjustmentType} onValueChange={(value) => setAdjustmentType(value as 'in' | 'out')} className="flex items-center gap-4 mt-2">
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="in" id="adjust-in" />
                                            <Label htmlFor="adjust-in">Ajuste de Entrada (Sumar Stock)</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="out" id="adjust-out" />
                                            <Label htmlFor="adjust-out">Ajuste de Salida (Restar Stock)</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <div>
                                    <Label htmlFor="barcode-ajuste">Escanear o Buscar Producto</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-grow">
                                            <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                id="barcode-ajuste"
                                                ref={adjustmentBarcodeRef}
                                                placeholder="Escanear SKU para agregar producto" 
                                                className="pl-8"
                                                onKeyDown={(e) => handleEntryBarcodeScan(e)}
                                            />
                                        </div>
                                        <Button variant="outline" size="icon" onClick={() => openSearchDialog('ajustes')}>
                                            <Search className="h-4 w-4" />
                                            <span className="sr-only">Buscar Producto</span>
                                        </Button>
                                    </div>
                                </div>
                                <Card>
                                    <CardHeader><CardTitle>Productos a Ajustar</CardTitle></CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Producto</TableHead>
                                                    <TableHead>SKU</TableHead>
                                                    <TableHead className="text-center w-[150px]">Cantidad</TableHead>
                                                    <TableHead className="text-right">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {adjustmentProducts.length > 0 ? (
                                                    adjustmentProducts.map(product => (
                                                        <TableRow key={product.sku}>
                                                            <TableCell className="font-medium">{product.name}</TableCell>
                                                            <TableCell>{product.sku}</TableCell>
                                                            <TableCell>
                                                                <Input 
                                                                    type="number"
                                                                    className="w-24 text-center mx-auto"
                                                                    value={product.quantity}
                                                                    onChange={(e) => handleAdjustmentQuantityChange(product.sku, parseInt(e.target.value, 10))}
                                                                    min="0"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveAdjustmentProduct(product.sku)}>
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center">Escanea o busca un producto para comenzar.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleRegisterAdjustment} disabled={isEntryPending}>
                                    {isEntryPending ? 'Registrando...' : 'Registrar Ajuste'}
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                )}


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
                                    <Button onClick={handleProcessReturn} disabled={isReturnProcessing}>
                                        {isReturnProcessing ? 'Procesando...' : 'Procesar Devolución'}
                                    </Button>
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
                                                value={damagedProduct?.sku || ''}
                                                readOnly
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
                                    <Button variant="destructive" onClick={handleRegisterDamage} disabled={isDamageProcessing}>
                                        {isDamageProcessing ? 'Registrando...' : 'Registrar Avería'}
                                    </Button>
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
