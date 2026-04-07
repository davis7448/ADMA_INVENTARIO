"use client";

import { useEffect, useState } from 'react';
import { getProductsForCatalog } from '@/lib/commercial-api';
import { Product, Category, Warehouse } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, Sparkles, PackageX, Building2, Tag, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function CatalogPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Record<string, string>>({});
    const [warehouses, setWarehouses] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    
    // Estados para controlar qué bodegas están expandidas (vacío = todo colapsado)
    const [expandedWarehouses, setExpandedWarehouses] = useState<Set<string>>(new Set());
    
    // Estados para controlar qué categorías están expandidas (vacío = todo colapsado)
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    
    // Estado para controlar cuántos productos mostrar en "Lo Más Quedado" (temporal durante la sesión)
    const [stuckLimit, setStuckLimit] = useState(20);
    
    // Estado para controlar cuántos productos mostrar en "Lo Más Nuevo" (temporal durante la sesión)
    const [newestLimit, setNewestLimit] = useState(20);

    useEffect(() => {
        async function load() {
            try {
                // Fetch products, categories and warehouses
                const [productsRes, metadataRes] = await Promise.all([
                    getProductsForCatalog(),
                    fetch('/api/commercial/catalog-metadata').then(res => res.json())
                ]);

                // Create map of categoryId -> name
                const categoriesMap: Record<string, string> = {};
                if (metadataRes.categories) {
                    metadataRes.categories.forEach((cat: Category) => {
                        categoriesMap[cat.id] = cat.name;
                    });
                }

                // Create map of warehouseId -> name
                const warehousesMap: Record<string, string> = {};
                if (metadataRes.warehouses) {
                    metadataRes.warehouses.forEach((wh: Warehouse) => {
                        warehousesMap[wh.id] = wh.name;
                    });
                }

                setCategories(categoriesMap);
                setWarehouses(warehousesMap);
                setProducts(productsRes);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // Funciones para toggle de bodegas
    const toggleWarehouse = (warehouseId: string) => {
        const newSet = new Set(expandedWarehouses);
        if (newSet.has(warehouseId)) {
            newSet.delete(warehouseId);
        } else {
            newSet.add(warehouseId);
        }
        setExpandedWarehouses(newSet);
    };

    // Funciones para toggle de categorías
    const toggleCategory = (categoryKey: string) => {
        const newSet = new Set(expandedCategories);
        if (newSet.has(categoryKey)) {
            newSet.delete(categoryKey);
        } else {
            newSet.add(categoryKey);
        }
        setExpandedCategories(newSet);
    };

    // Logic for filters
    const getNewest = () => {
        const sorted = [...products]
            .filter(p => p.stock > 0)
            .sort((a, b) => new Date(b.purchaseDate || 0).getTime() - new Date(a.purchaseDate || 0).getTime());
        
        return {
            products: sorted.slice(0, newestLimit),
            total: sorted.length,
            hasMore: sorted.length > newestLimit
        };
    };
    
    const loadMoreNewest = () => {
        setNewestLimit(prev => prev + 20);
    };

    const getStuck = () => {
        // "Quedado": High stock, old purchase date.
        // Simple heuristic: Oldest purchase date with stock > 5 (and > 0 to exclude out of stock)
        const filtered = [...products]
            .filter(p => p.stock > 5)
            .sort((a, b) => new Date(a.purchaseDate || new Date()).getTime() - new Date(b.purchaseDate || new Date()).getTime());
        
        return {
            products: filtered.slice(0, stuckLimit),
            total: filtered.length,
            hasMore: filtered.length > stuckLimit
        };
    };
    
    const loadMoreStuck = () => {
        setStuckLimit(prev => prev + 20);
    };

    const getLiquidating = () => {
        // "Liquidacion": Maybe check descriptions for "Sale" or specific category?
        // Fallback: Random or based on rotationCategoryName 'Bajo'
        return products.filter(p => p.stock > 0 && (p.rotationCategoryName === 'Baja' || p.rotationCategoryName === 'Liquidacion'));
    };

    const getLowRotationByWarehouse = () => {
        // Filter products without rotation (Low, null, undefined or empty) and with stock > 0
        const lowRotationProducts = products.filter(p => 
            p.stock > 0 &&
            (!p.rotationCategoryName || 
            p.rotationCategoryName === 'Baja' ||
            p.rotationCategoryName === '')
        );

        // Group by warehouse and then by category
        const grouped: Record<string, {
            warehouseName: string;
            categories: Record<string, {
                categoryName: string;
                products: Product[];
            }>;
        }> = {};

        lowRotationProducts.forEach(product => {
            const warehouseId = product.warehouseId || 'sin-bodega';
            const categoryId = product.categoryId || 'sin-categoria';
            
            // Get names
            const warehouseName = warehouses[warehouseId] || 'Sin Bodega';
            const categoryName = categories[categoryId] || 'Sin Categoría';
            
            // Initialize structure if doesn't exist
            if (!grouped[warehouseId]) {
                grouped[warehouseId] = {
                    warehouseName,
                    categories: {}
                };
            }
            
            if (!grouped[warehouseId].categories[categoryId]) {
                grouped[warehouseId].categories[categoryId] = {
                    categoryName,
                    products: []
                };
            }
            
            // Add product
            grouped[warehouseId].categories[categoryId].products.push(product);
        });

        // Sort products by stock descending within each category
        Object.values(grouped).forEach(warehouse => {
            Object.values(warehouse.categories).forEach(category => {
                category.products.sort((a, b) => b.stock - a.stock);
            });
        });

        return grouped;
    };

    // Helper function to safely format purchase date
    const formatPurchaseDate = (purchaseDate: any): string => {
        if (!purchaseDate) return '';
        
        try {
            // If it's already a string
            if (typeof purchaseDate === 'string') {
                return purchaseDate.split('T')[0];
            }
            
            // If it's a Firestore Timestamp (has seconds and nanoseconds)
            if (typeof purchaseDate === 'object' && purchaseDate.seconds !== undefined) {
                return new Date(purchaseDate.seconds * 1000).toISOString().split('T')[0];
            }
            
            // If it's a regular Date object or timestamp
            const date = new Date(purchaseDate);
            if (isNaN(date.getTime())) {
                return '';
            }
            return date.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    const LowRotationGroupedView = () => {
        const grouped = getLowRotationByWarehouse();
        const warehouseEntries = Object.entries(grouped);

        if (warehouseEntries.length === 0) {
            return (
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl">
                    No se encontraron productos sin rotación.
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {warehouseEntries.map(([warehouseId, warehouseData]) => {
                    const isWarehouseExpanded = expandedWarehouses.has(warehouseId);
                    const totalWarehouseProducts = Object.values(warehouseData.categories).reduce(
                        (total, cat) => total + cat.products.length, 0
                    );
                    
                    return (
                        <Collapsible 
                            key={warehouseId}
                            open={isWarehouseExpanded}
                            onOpenChange={() => toggleWarehouse(warehouseId)}
                        >
                            <div className="border rounded-xl overflow-hidden bg-card">
                                {/* Warehouse Header - Collapsible Trigger */}
                                <CollapsibleTrigger asChild>
                                    <div 
                                        className="bg-primary/5 px-6 py-4 border-b flex items-center gap-3 hover:bg-primary/10 transition-colors cursor-pointer select-none"
                                    >
                                        {isWarehouseExpanded ? (
                                            <ChevronDown className="h-5 w-5 text-primary flex-shrink-0" />
                                        ) : (
                                            <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                                        )}
                                        <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                                        <h3 className="text-lg font-bold">{warehouseData.warehouseName}</h3>
                                        <Badge variant="secondary" className="ml-auto">
                                            {totalWarehouseProducts} productos
                                        </Badge>
                                    </div>
                                </CollapsibleTrigger>
                                
                                {/* Categories within warehouse */}
                                <CollapsibleContent>
                                    <div className="p-6 space-y-4">
                                        {Object.entries(warehouseData.categories).map(([categoryId, categoryData]) => {
                                            const categoryKey = `${warehouseId}-${categoryId}`;
                                            const isCategoryExpanded = expandedCategories.has(categoryKey);
                                            
                                            return (
                                                <Collapsible
                                                    key={categoryId}
                                                    open={isCategoryExpanded}
                                                    onOpenChange={() => toggleCategory(categoryKey)}
                                                >
                                                    <div className="border rounded-lg bg-muted/20">
                                                        {/* Category Header - Collapsible Trigger */}
                                                        <CollapsibleTrigger asChild>
                                                            <div 
                                                                className="flex items-center gap-2 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer select-none"
                                                            >
                                                                {isCategoryExpanded ? (
                                                                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                                ) : (
                                                                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                                )}
                                                                <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                                <h4 className="font-semibold text-muted-foreground uppercase tracking-wide text-sm">
                                                                    {categoryData.categoryName}
                                                                </h4>
                                                                <span className="text-xs text-muted-foreground ml-auto">
                                                                    {categoryData.products.length} productos
                                                                </span>
                                                            </div>
                                                        </CollapsibleTrigger>
                                                        
                                                        {/* Product grid ordered by stock */}
                                                        <CollapsibleContent>
                                                            <div className="px-4 pb-4">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                                    {categoryData.products.map(product => (
                                                                        <Card key={product.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300">
                                                                            <div className="relative aspect-square">
                                                                                <img
                                                                                    src={product.imageUrl}
                                                                                    alt={product.name}
                                                                                    className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500"
                                                                                />
                                                                                <Badge className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white">
                                                                                    Stock: {product.stock}
                                                                                </Badge>
                                                                            </div>
                                                                            <CardContent className="p-4">
                                                                                <h3 className="font-bold text-base line-clamp-1 mb-1">{product.name}</h3>
                                                                                <div className="text-sm text-muted-foreground mb-2">
                                                                                    {product.sku}
                                                                                </div>
                                                                                <div className="text-lg font-bold text-primary">
                                                                                    ${(product.priceDropshipping || 0).toLocaleString()}
                                                                                </div>
                                                                                {product.purchaseDate && (
                                                                                    <div className="text-xs text-muted-foreground mt-1">
                                                                                        Compra: {formatPurchaseDate(product.purchaseDate)}
                                                                                    </div>
                                                                                )}
                                                                            </CardContent>
                                                                        </Card>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </CollapsibleContent>
                                                    </div>
                                                </Collapsible>
                                            );
                                        })}
                                    </div>
                                </CollapsibleContent>
                            </div>
                        </Collapsible>
                    );
                })}
            </div>
        );
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
                            <Badge className="absolute top-2 right-2 bg-green-500 hover:bg-green-600 text-white">
                                Stock: {product.stock}
                            </Badge>
                        ) : (
                            <Badge variant="destructive" className="absolute top-2 right-2 text-white">
                                Agotado
                            </Badge>
                        )}
                    </div>
                    <CardContent className="p-4">
                        <h3 className="font-bold text-lg line-clamp-1 mb-1">{product.name}</h3>
                        <div className="flex justify-between items-center text-sm text-muted-foreground mb-3">
                            <span>{product.sku}</span>
                            <span>{formatPurchaseDate(product.purchaseDate)}</span>
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
                <TabsList className="grid w-full grid-cols-4 mb-8">
                    <TabsTrigger value="newest" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" /> Lo Más Nuevo
                    </TabsTrigger>
                    <TabsTrigger value="stuck" className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" /> Por Activar
                    </TabsTrigger>
                    <TabsTrigger value="liquidating" className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" /> Liquidación
                    </TabsTrigger>
                    <TabsTrigger value="lowrotation" className="flex items-center gap-2">
                        <PackageX className="h-4 w-4 text-orange-500" /> Sin Rotación
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="newest" className="animate-in fade-in-50 duration-500">
                    {(() => {
                        const { products, hasMore } = getNewest();
                        return (
                            <>
                                <ProductGrid items={products} />
                                {hasMore && (
                                    <div className="mt-8 flex justify-center">
                                        <Button
                                            onClick={loadMoreNewest}
                                            variant="outline"
                                            className="gap-2"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Mostrar más
                                        </Button>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </TabsContent>
                <TabsContent value="stuck" className="animate-in fade-in-50 duration-500">
                    {(() => {
                        const { products, hasMore } = getStuck();
                        return (
                            <>
                                <ProductGrid items={products} />
                                {hasMore && (
                                    <div className="mt-8 flex justify-center">
                                        <Button 
                                            onClick={loadMoreStuck}
                                            variant="outline" 
                                            className="gap-2"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Mostrar más
                                        </Button>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </TabsContent>
                <TabsContent value="liquidating" className="animate-in fade-in-50 duration-500">
                    <ProductGrid items={getLiquidating()} />
                </TabsContent>
                <TabsContent value="lowrotation" className="animate-in fade-in-50 duration-500">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <LowRotationGroupedView />
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
