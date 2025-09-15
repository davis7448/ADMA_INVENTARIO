

"use client";

import { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "@/components/ui/tooltip"
import { Button } from '@/components/ui/button';
import { getProducts, getSuppliersByIds, getCategoriesByIds } from '@/lib/api';
import type { Product, RotationCategory } from '@/lib/types';
import { MoreHorizontal, TrendingUp, ArrowUpCircle, CheckCircle, ArrowDownCircle, XCircle, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AddProductForm } from '@/components/add-product-form';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { EditProductForm } from './edit-product-form';
import { cn } from '@/lib/utils';
import { ProductDetailDialog } from './product-detail-dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface ProductsContentProps {
    initialProducts: Product[];
    initialSupplierNames: Record<string, string>;
    initialCategoryNames: Record<string, string>;
    allRotationCategories: RotationCategory[];
}

export function ProductsContent({ initialProducts, initialSupplierNames, initialCategoryNames, allRotationCategories }: ProductsContentProps) {
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [supplierNames, setSupplierNames] = useState<Record<string, string>>(initialSupplierNames);
    const [categoryNames, setCategoryNames] = useState<Record<string, string>>(initialCategoryNames);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedRotation, setSelectedRotation] = useState('all');
    const [minStock, setMinStock] = useState('');
    const [hasPending, setHasPending] = useState(false);
    
    const refreshProducts = async () => {
        setLoading(true);
        // This should be refetched from the server page component to get updated rotation
        window.location.reload();
    }

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const lowercasedQuery = searchQuery.toLowerCase();
            // Text search
            const searchMatch = searchQuery.length > 2 
                ? product.name.toLowerCase().includes(lowercasedQuery) || 
                  (product.sku && product.sku.toLowerCase().includes(lowercasedQuery)) ||
                  (product.productType === 'variable' && product.variants?.some(variant => 
                      variant.name.toLowerCase().includes(lowercasedQuery) ||
                      variant.sku.toLowerCase().includes(lowercasedQuery)
                  ))
                : true;
            
            // Category filter
            const categoryMatch = selectedCategory === 'all' || product.categoryId === selectedCategory;

            // Rotation filter
            const rotationMatch = selectedRotation === 'all' || product.rotationCategoryName === selectedRotation;

            // Min stock filter
            const stockMatch = minStock === '' || product.stock >= parseInt(minStock, 10);

            // Has pending filter
            const pendingMatch = !hasPending || (product.pendingStock && product.pendingStock > 0);

            return searchMatch && categoryMatch && rotationMatch && stockMatch && pendingMatch;
        });
    }, [products, searchQuery, selectedCategory, selectedRotation, minStock, hasPending]);

    const handleRowClick = (productId: string) => {
        setSelectedProductId(productId);
    };

    const handleDialogChange = (open: boolean) => {
        if (!open) {
            setSelectedProductId(null);
        }
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedCategory('all');
        setSelectedRotation('all');
        setMinStock('');
        setHasPending(false);
    };

    const canEdit = user?.role === 'admin';

    const getRotationIcon = (categoryName?: string) => {
        if (!categoryName) return null;

        const iconProps = { className: "h-5 w-5" };

        switch(categoryName) {
            case 'Escalado':
                return <TrendingUp {...iconProps} color="cyan" />;
            case 'Alta rotación':
                return <ArrowUpCircle {...iconProps} color="green" />;
            case 'Activo':
                return <CheckCircle {...iconProps} color="blue" />;
            case 'Baja rotación':
                return <ArrowDownCircle {...iconProps} color="orange" />;
            case 'Inactivo':
                return <XCircle {...iconProps} color="red" />;
            default:
                return null;
        }
    }

    const handleExportExcel = () => {
        const dataToExport = filteredProducts.map(p => ({
            'Nombre': p.name,
            'SKU': p.sku || (p.productType === 'variable' ? 'N/A (Variable)' : 'N/A'),
            'Tipo': p.productType,
            'Categoría': categoryNames[p.categoryId] || 'Unknown',
            'Rotación': p.rotationCategoryName || 'N/A',
            'Stock Físico': p.stock,
            'Stock Pendiente': p.pendingStock || 0,
            'Stock Averiado': p.damagedStock || 0,
            'Precio': p.price,
            'Costo': canEdit ? p.cost : undefined, // Only include cost for admins
            'Proveedor': supplierNames[p.vendorId] || 'Unknown',
            'Fecha Compra': p.purchaseDate ? format(new Date(p.purchaseDate), 'yyyy-MM-dd') : '',
        }));
    
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
        XLSX.writeFile(workbook, `Productos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      };


    return (
        <TooltipProvider>
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Product Catalog</h1>
              <p className="text-muted-foreground">Browse and manage your product listings.</p>
            </div>
            {canEdit && <AddProductForm onProductAdded={refreshProducts} />}
          </div>

          <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Filtros</CardTitle>
                    <Button variant="ghost" onClick={clearFilters}>Limpiar Filtros</Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="search">Buscar producto</Label>
                        <Input id="search" placeholder="Nombre o SKU..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="category">Categoría</Label>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las Categorías</SelectItem>
                                {Object.entries(categoryNames).map(([id, name]) => (
                                    <SelectItem key={id} value={id}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rotation">Rotación</Label>
                        <Select value={selectedRotation} onValueChange={setSelectedRotation}>
                            <SelectTrigger id="rotation"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toda la Rotación</SelectItem>
                                {allRotationCategories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="min-stock">Stock Mínimo</Label>
                        <Input id="min-stock" type="number" placeholder="Ej: 10" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
                    </div>
                </div>
                 <div className="flex items-center space-x-2 pt-2">
                    <Switch id="pending-stock" checked={hasPending} onCheckedChange={setHasPending} />
                    <Label htmlFor="pending-stock">Mostrar solo con stock pendiente</Label>
                </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>All Products</CardTitle>
                        <CardDescription>A list of all products in your catalog. ({filteredProducts.length} de {products.length} mostrados)</CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleExportExcel}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Exportar a Excel
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden w-[100px] sm:table-cell">
                      <span className="sr-only">Image</span>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Rotación</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden md:table-cell">Stock</TableHead>
                    <TableHead className="hidden md:table-cell">Pendiente</TableHead>
                    <TableHead className="hidden md:table-cell">Averiado</TableHead>
                    <TableHead>Price</TableHead>
                    {canEdit && (
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                     Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell className="hidden sm:table-cell">
                                <Skeleton className="h-16 w-16 rounded-md" />
                            </TableCell>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-12" /></TableCell>
                            <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-12" /></TableCell>
                            <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-12" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            {canEdit && <TableCell><Skeleton className="h-8 w-8" /></TableCell>}
                        </TableRow>
                     ))
                  ) : (
                    filteredProducts.map((product) => (
                        <TableRow key={product.id} onClick={() => handleRowClick(product.id)} className="cursor-pointer">
                        <TableCell className="hidden sm:table-cell">
                            <Image
                            alt={product.name}
                            className="aspect-square rounded-md object-cover"
                            height="64"
                            src={product.imageUrl}
                            width="64"
                            />
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                            <Badge variant={product.productType === 'simple' ? 'secondary' : 'outline'}>{product.productType}</Badge>
                        </TableCell>
                        <TableCell>
                            <Tooltip>
                                <TooltipTrigger>
                                    {getRotationIcon(product.rotationCategoryName)}
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{product.rotationCategoryName}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell>
                            <Badge variant="outline">{categoryNames[product.categoryId] || 'Unknown'}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{product.stock}</TableCell>
                        <TableCell className="hidden md:table-cell text-center text-orange-500 font-semibold">{product.pendingStock || 0}</TableCell>
                        <TableCell className="hidden md:table-cell text-center text-destructive font-semibold">{product.damagedStock || 0}</TableCell>
                        <TableCell>${Math.round(product.price).toFixed(0)}</TableCell>
                        {canEdit && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Toggle menu</span>
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <EditProductForm product={product} onProductUpdated={refreshProducts}>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>
                                </EditProductForm>
                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            </TableCell>
                        )}
                        </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredProducts.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                    <p>No se encontraron productos con los filtros actuales.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {selectedProductId && (
            <ProductDetailDialog
                productId={selectedProductId}
                open={!!selectedProductId}
                onOpenChange={handleDialogChange}
                onProductUpdate={refreshProducts}
            />
        )}
        </TooltipProvider>
    )
}
