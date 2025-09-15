
"use client";

import { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { getProducts, getSupplierById } from '@/lib/api';
import type { Product } from '@/lib/types';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AddProductForm } from '@/components/add-product-form';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

function ProductsContent() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const [supplierNames, setSupplierNames] = useState<Record<string, string>>({});

    useEffect(() => {
      async function fetchProducts() {
        setLoading(true);
        const fetchedProducts = await getProducts();
        setProducts(fetchedProducts);
        setLoading(false);
      }
      fetchProducts();
    }, []);

    useEffect(() => {
        const fetchSupplierNames = async () => {
            const uniqueVendorIds = [...new Set(products.map(p => p.vendorId))];
            const names: Record<string, string> = {};
            for (const vendorId of uniqueVendorIds) {
                if (!supplierNames[vendorId]) {
                    const supplier = await getSupplierById(vendorId);
                    names[vendorId] = supplier?.name ?? 'Unknown';
                }
            }
            setSupplierNames(prev => ({ ...prev, ...names }));
        };

        if (products.length > 0) {
            fetchSupplierNames();
        }
    }, [products]);


    const canEdit = user?.role === 'admin';

    return (
        <AuthProviderWrapper allowedRoles={['admin', 'commercial']}>
          <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Product Catalog</h1>
              <p className="text-muted-foreground">Browse and manage your product listings.</p>
            </div>
            {canEdit && <AddProductForm onProductAdded={async () => setProducts(await getProducts())} />}
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
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden md:table-cell">Supplier</TableHead>
                    <TableHead className="hidden md:table-cell">Stock</TableHead>
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
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-12" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            {canEdit && <TableCell><Skeleton className="h-8 w-8" /></TableCell>}
                        </TableRow>
                     ))
                  ) : (
                    products.map((product) => (
                        <TableRow key={product.id}>
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
                        <TableCell>{product.sku}</TableCell>
                        <TableCell>
                            <Badge variant="outline">{product.category}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{supplierNames[product.vendorId] || 'Loading...'}</TableCell>
                        <TableCell className="hidden md:table-cell">{product.stock}</TableCell>
                        <TableCell>${product.price.toFixed(2)}</TableCell>
                        {canEdit && (
                            <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Toggle menu</span>
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem>Edit</DropdownMenuItem>
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
      </AuthProviderWrapper>
    )
}

export default function ProductsPage() {
    return <ProductsContent />;
}
