"use client";

import { useEffect, useState } from 'react';
import { getProductsForCatalog } from '@/lib/commercial-api';
import { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, Sparkles } from 'lucide-react';

export default function CatalogPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                // Fetch all and filter client side for better performance on sorting 
                // (assuming < 1000 items, pagination otherwise would need server-side sort)
                const res = await getProducts({ limit: 500, fetchAll: true });
                setProducts(res.products);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // Logic for filters
    const getNewest = () => {
        return [...products]
            .sort((a, b) => new Date(b.purchaseDate || 0).getTime() - new Date(a.purchaseDate || 0).getTime())
            .slice(0, 20);
    };

    const getStuck = () => {
        // "Quedado": High stock, old purchase date. 
        // Simple heuristic: Oldest purchase date with stock > 10
        return [...products]
            .filter(p => p.stock > 5)
            .sort((a, b) => new Date(a.purchaseDate || new Date()).getTime() - new Date(b.purchaseDate || new Date()).getTime())
            .slice(0, 20);
    };

    const getLiquidating = () => {
        // "Liquidacion": Maybe check descriptions for "Sale" or specific category?
        // Fallback: Random or based on rotationCategoryName 'Bajo'
        return products.filter(p => p.rotationCategoryName === 'Baja' || p.rotationCategoryName === 'Liquidacion');
    };

    const ProductGrid = ({ items }: { items: Product[] }) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map(product => (
                <Card key={product.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300">
                    <div className="relative aspect-square">
                        <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                        />
                        {product.stock > 0 ? (
                            <Badge className="absolute top-2 right-2 bg-green-500 hover:bg-green-600">
                                Stock: {product.stock}
                            </Badge>
                        ) : (
                            <Badge variant="destructive" className="absolute top-2 right-2">
                                Agotado
                            </Badge>
                        )}
                    </div>
                    <CardContent className="p-4">
                        <h3 className="font-bold text-lg line-clamp-1 mb-1">{product.name}</h3>
                        <div className="flex justify-between items-center text-sm text-muted-foreground mb-3">
                            <span>{product.sku}</span>
                            <span>{product.purchaseDate?.split('T')[0]}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <div className="text-xl font-bold text-primary">
                                ${(product.priceDropshipping || 0).toLocaleString()}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
            {items.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl">
                    No se encontraron productos en esta categoría.
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Catálogo Comercial</h1>
                <p className="text-muted-foreground">Encuentra oportunidades de venta, novedades y liquidaciones.</p>
            </div>

            <Tabs defaultValue="newest" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-8">
                    <TabsTrigger value="newest" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" /> Lo Más Nuevo
                    </TabsTrigger>
                    <TabsTrigger value="stuck" className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" /> Lo Más Quedado
                    </TabsTrigger>
                    <TabsTrigger value="liquidating" className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" /> Liquidación
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="newest" className="animate-in fade-in-50 duration-500">
                    <ProductGrid items={getNewest()} />
                </TabsContent>
                <TabsContent value="stuck" className="animate-in fade-in-50 duration-500">
                    <ProductGrid items={getStuck()} />
                </TabsContent>
                <TabsContent value="liquidating" className="animate-in fade-in-50 duration-500">
                    <ProductGrid items={getLiquidating()} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
