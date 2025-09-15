"use client";

import { useState, useRef, useEffect } from 'react';
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
import { products } from '@/lib/data';
import type { Product } from '@/lib/types';
import { Barcode, Trash2 } from 'lucide-react';
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

interface DispatchedProduct extends Product {
    dispatchQuantity: number;
}

interface ReturnedProduct extends Product {
    trackingNumber: string;
}

const platforms = ['Mercado Libre', 'Shopify', 'Amazon', 'Tienda Propia'];
const carriers = ['DHL', 'FedEx', 'UPS', 'Estafeta'];

export default function LogisticsPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [platform, setPlatform] = useState('');
    const [carrier, setCarrier] = useState('');
    const [dispatchedProducts, setDispatchedProducts] = useState<DispatchedProduct[]>([]);
    const barcodeRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    // State for returns
    const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
    const [returnCarrier, setReturnCarrier] = useState('');
    const [returnedProducts, setReturnedProducts] = useState<ReturnedProduct[]>([]);
    const [currentTrackingNumber, setCurrentTrackingNumber] = useState('');
    const [productToAdd, setProductToAdd] = useState<Product | null>(null);
    const returnBarcodeRef = useRef<HTMLInputElement>(null);
    const trackingDialogCloseRef = useRef<HTMLButtonElement>(null);


    useEffect(() => {
        if (user && user.role !== 'logistics' && user.role !== 'admin') {
          router.push('/');
        }
    }, [user, router]);


    const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const barcode = e.currentTarget.value;
          const product = products.find(p => p.sku === barcode);
    
          if (product) {
            setDispatchedProducts(prev => {
              const existingProduct = prev.find(p => p.id === product.id);
              if (existingProduct) {
                return prev.map(p => 
                  p.id === product.id 
                    ? { ...p, dispatchQuantity: p.dispatchQuantity + 1 } 
                    : p
                );
              }
              return [...prev, { ...product, dispatchQuantity: 1 }];
            });
            toast({ title: "Producto Agregado", description: `${product.name} añadido al despacho.` });
          } else {
            toast({ variant: 'destructive', title: "Error", description: "Producto no encontrado." });
          }
          if(barcodeRef.current) barcodeRef.current.value = '';
        }
      };

    const handleRemoveProduct = (productId: string) => {
        setDispatchedProducts(prev => prev.filter(p => p.id !== productId));
    };

    const handleCreateDispatch = () => {
        if (!platform || !carrier || dispatchedProducts.length === 0) {
            toast({
              variant: 'destructive',
              title: "Faltan datos",
              description: "Por favor, selecciona plataforma, transportadora y agrega productos.",
            });
            return;
        }

        console.log({
            platform,
            carrier,
            products: dispatchedProducts.map(p => ({ id: p.id, sku: p.sku, quantity: p.dispatchQuantity }))
        });

        toast({
            title: "Salida Creada",
            description: `Se ha creado una salida con ${dispatchedProducts.length} producto(s) para ${platform}.`
        });

        setPlatform('');
        setCarrier('');
        setDispatchedProducts([]);
    }

    const handleReturnBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const barcode = e.currentTarget.value;
            const product = products.find(p => p.sku === barcode);

            if (product) {
                setProductToAdd(product);
                setIsReturnDialogOpen(true);
            } else {
                toast({ variant: 'destructive', title: "Error", description: "Producto no encontrado." });
            }
            if(returnBarcodeRef.current) returnBarcodeRef.current.value = '';
        }
    };
    
    const handleAddProductToReturn = () => {
        if (productToAdd && currentTrackingNumber) {
            setReturnedProducts(prev => [...prev, { ...productToAdd, trackingNumber: currentTrackingNumber }]);
            toast({ title: "Producto Agregado", description: `${productToAdd.name} añadido a la devolución.` });
            
            // Close dialog and reset state
            setIsReturnDialogOpen(false);
            setProductToAdd(null);
            setCurrentTrackingNumber('');
        } else {
            toast({ variant: 'destructive', title: "Error", description: "Por favor, ingresa un número de guía." });
        }
    };


     const handleRemoveReturnedProduct = (sku: string, trackingNumber: string) => {
        setReturnedProducts(prev => prev.filter(p => !(p.sku === sku && p.trackingNumber === trackingNumber)));
    };

    const handleProcessReturn = () => {
        if (!returnCarrier || returnedProducts.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Faltan datos',
                description: 'Por favor, selecciona una transportadora y agrega productos a la devolución.'
            });
            return;
        }
        
        toast({
            title: 'Devolución Procesada',
            description: `Se ha procesado una devolución con ${returnedProducts.length} producto(s) de la transportadora ${returnCarrier}.`
        });
        
        setReturnCarrier('');
        setReturnedProducts([]);
    };


    if (user?.role !== 'logistics' && user?.role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>
            </div>
        );
    }
    
    return (
        <Dialog open={isReturnDialogOpen} onOpenChange={(open) => {
            setIsReturnDialogOpen(open);
            if (!open) {
                setProductToAdd(null);
                setCurrentTrackingNumber('');
            }
        }}>
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
                                            {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
                                            {carriers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="barcode-salida">Escanear Código de Barras (SKU)</Label>
                                    <div className="relative">
                                        <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            id="barcode-salida"
                                            ref={barcodeRef}
                                            placeholder="Escanear SKU del producto y presionar Enter" 
                                            className="pl-8"
                                            onKeyDown={handleBarcodeScan}
                                        />
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">Usa el SKU del producto (ej: WM-ERGO-01) como código de barras.</p>
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
                                                    <TableHead className="text-center">Cantidad</TableHead>
                                                    <TableHead className="text-right">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                            {dispatchedProducts.length > 0 ? (
                                                dispatchedProducts.map(product => (
                                                <TableRow key={product.id}>
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
                                                    <TableCell className="text-center">{product.dispatchQuantity}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveProduct(product.id)}>
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
                                    <Label htmlFor="barcode-entrada">Escanear Código de Barras (SKU)</Label>
                                    <div className="relative">
                                        <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            id="barcode-entrada"
                                            placeholder="Escanear SKU para agregar producto" 
                                            className="pl-8"
                                        />
                                    </div>
                                </div>
                                 <Card>
                                    <CardHeader><CardTitle>Productos Recibidos</CardTitle></CardHeader>
                                    <CardContent>
                                         <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Producto</TableHead>
                                                    <TableHead>SKU</TableHead>
                                                    <TableHead className="text-center w-[150px]">Cantidad</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center">Escanea un producto para comenzar.</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </CardContent>
                            <CardFooter>
                                <Button>Registrar Entrada</Button>
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
                                                    {carriers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                         <div>
                                            <Label htmlFor="return-barcode">Escanear Código de Barras (SKU)</Label>
                                            <div className="relative">
                                                <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input 
                                                    id="return-barcode"
                                                    ref={returnBarcodeRef}
                                                    placeholder="Escanear SKU para agregar producto a la devolución" 
                                                    className="pl-8"
                                                    onKeyDown={handleReturnBarcodeScan}
                                                />
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
                                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveReturnedProduct(p.sku, p.trackingNumber)}>
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
                                         <div>
                                            <Label htmlFor="damage-product-sku">SKU del Producto Averiado</Label>
                                            <Input id="damage-product-sku" placeholder="Ej: WM-ERGO-01" />
                                        </div>
                                        <div>
                                            <Label>Descripción del Daño</Label>
                                            <Textarea placeholder="Describe el daño o el problema del producto..." />
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button variant="destructive">Registrar Avería</Button>
                                    </CardFooter>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </TabsContent>
                </Tabs>
            </div>
            
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
    );
}
