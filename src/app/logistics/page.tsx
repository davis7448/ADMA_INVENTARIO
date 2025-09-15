"use client";

import { useState, useRef, useEffect } from 'react';
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

interface DispatchedProduct extends Product {
    dispatchQuantity: number;
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

    useEffect(() => {
        if (user && user.role !== 'logistics' && user.role !== 'admin') {
          router.push('/');
        }
    }, [user, router]);


    const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const barcode = e.currentTarget.value;
          // In a real app, you'd find the product by barcode.
          // Here, we'll simulate by using the product ID as a "barcode".
          const product = products.find(p => p.id === barcode);
    
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
          // Clear input
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

        // Here you would typically send the data to your backend
        console.log({
            platform,
            carrier,
            products: dispatchedProducts.map(p => ({ id: p.id, quantity: p.dispatchQuantity }))
        });

        toast({
            title: "Salida Creada",
            description: `Se ha creado una salida con ${dispatchedProducts.length} producto(s) para ${platform}.`
        });

        // Reset form
        setPlatform('');
        setCarrier('');
        setDispatchedProducts([]);
    }

    if (user?.role !== 'logistics' && user?.role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Panel de Logística</h1>
              <p className="text-muted-foreground">Gestiona la salida de pedidos y despachos.</p>
            </div>
      
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
                    <Label htmlFor="barcode">Escanear Código de Barras</Label>
                    <div className="relative">
                        <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="barcode"
                            ref={barcodeRef}
                            placeholder="Pistolear código de barras del producto y presionar Enter" 
                            className="pl-8"
                            onKeyDown={handleBarcodeScan}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Simulación: usa el ID del producto (ej: prod-1, prod-2) como código de barras.</p>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Productos a Despachar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-center">Cantidad</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {dispatchedProducts.length > 0 ? (
                                dispatchedProducts.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
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
                                <TableCell colSpan={3} className="text-center">Aún no hay productos en el despacho.</TableCell>
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
        </div>
    );
}
