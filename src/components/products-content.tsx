

"use client";

import { useState } from 'react';
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
import type { Product } from '@/lib/types';
import { MoreHorizontal, TrendingUp, ArrowUpCircle, CheckCircle, ArrowDownCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AddProductForm } from '@/components/add-product-form';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { EditProductForm } from './edit-product-form';
import { cn } from '@/lib/utils';
import { ProductDetailSheet } from './product-detail-sheet';

interface ProductsContentProps {
    initialProducts: Product[];
    initialSupplierNames: Record<string, string>;
    initialCategoryNames: Record<string, string>;
}

export function ProductsContent({ initialProducts, initialSupplierNames, initialCategoryNames }: ProductsContentProps) {
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [supplierNames, setSupplierNames] = useState<Record<string, string>>(initialSupplierNames);
    const [categoryNames, setCategoryNames] = useState<Record<string, string>>(initialCategoryNames);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    
    const refreshProducts = async () => {
        setLoading(true);
        // This should be refetched from the server page component to get updated rotation
        window.location.reload();
    }

    const handleRowClick = (productId: string) => {
        setSelectedProductId(productId);
    };

    const handleSheetOpenChange = (open: boolean) => {
        if (!open) {
            setSelectedProductId(null);
        }
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
              <CardTitle>All Products</CardTitle>
              <CardDescription>A list of all products in your catalog.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden w-[100px] sm:table-cell">
                      <span className="sr-only">Image</span>
                    </TableHead>
                    <TableHead>Name</TableHead>
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
                    products.map((product) => (
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
            </CardContent>
          </Card>
        </div>
        {selectedProductId && (
            <ProductDetailSheet 
                productId={selectedProductId}
                open={!!selectedProductId}
                onOpenChange={handleSheetOpenChange}
            />
        )}
        </TooltipProvider>
    )
}
