

"use client";

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "@/components/ui/tooltip"
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
import { Button } from '@/components/ui/button';
import { getVendedores } from '@/lib/api';
import type { Product, RotationCategory, Vendedor } from '@/lib/types';
import { MoreHorizontal, TrendingUp, ArrowUpCircle, CheckCircle, ArrowDownCircle, XCircle, FileSpreadsheet, ChevronDown, Upload, Settings, ShieldCheck, Check, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AddProductForm } from '@/components/add-product-form';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { EditProductForm } from './edit-product-form';
import { ProductDetailDialog } from './product-detail-dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ImportProductsDialog } from './import-products-dialog';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { auditProductStockAction, clearProductAuditAction, deleteProductAction } from '@/app/actions/products';
import { useToast } from '@/hooks/use-toast';
import { formatToTimeZone } from '@/lib/utils';
import { AlertDialogTrigger } from './ui/alert-dialog';

interface ProductsContentProps {
    initialProducts: Product[];
    totalPages: number;
    initialSupplierNames: Record<string, string>;
    initialCategoryNames: Record<string, string>;
    allRotationCategories: RotationCategory[];
}

export function ProductsContent({ initialProducts, totalPages, initialSupplierNames, initialCategoryNames, allRotationCategories }: ProductsContentProps) {
    const [loading, setLoading] = useState(false);
    const { user, warehouses } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [vendedores, setVendedores] = useState<Vendedor[]>([]);

    // Filter states from URL
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
    const [selectedRotation, setSelectedRotation] = useState(searchParams.get('rotation') || 'all');
    const [selectedVendedor, setSelectedVendedor] = useState(searchParams.get('vendedor') || 'all');
    const [minStock, setMinStock] = useState(searchParams.get('minStock') || '');
    const [hasPending, setHasPending] = useState(searchParams.get('pending') === 'true');
    const [hasReservations, setHasReservations] = useState(searchParams.get('reservations') === 'true');
    const [onlyAudited, setOnlyAudited] = useState(searchParams.get('audited') === 'true');

    // Pagination states from URL
    const currentPage = Number(searchParams.get('page') || '1');
    const itemsPerPage = Number(searchParams.get('limit') || '20');

    useEffect(() => {
        getVendedores().then(setVendedores);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (searchQuery) params.set('q', searchQuery); else params.delete('q');
        if (selectedCategory !== 'all') params.set('category', selectedCategory); else params.delete('category');
        if (selectedRotation !== 'all') params.set('rotation', selectedRotation); else params.delete('rotation');
        if (selectedVendedor !== 'all') params.set('vendedor', selectedVendedor); else params.delete('vendedor');
        if (minStock) params.set('minStock', minStock); else params.delete('minStock');
        if (hasPending) params.set('pending', 'true'); else params.delete('pending');
        if (hasReservations) params.set('reservations', 'true'); else params.delete('reservations');
        if (onlyAudited) params.set('audited', 'true'); else params.delete('audited');
        
        // When filters change, always go back to page 1
        params.set('page', '1');
        router.replace(`${pathname}?${params.toString()}`);
    }, [searchQuery, selectedCategory, selectedRotation, selectedVendedor, minStock, hasPending, hasReservations, onlyAudited]);

    const refreshProducts = () => {
        setLoading(true);
        router.refresh();
        setLoading(false);
    }

    const handleToggleRow = (productId: string) => {
        setExpandedRow(prev => (prev === productId ? null : productId));
    };

    const [isProcessing, startTransition] = useTransition();

    const handleDeleteProduct = (e: React.MouseEvent, productId: string) => {
        e.stopPropagation();
        if (!user) return;
        startTransition(async () => {
            const result = await deleteProductAction(productId, user);
            if (result.success) {
                toast({
                    title: '¡Éxito!',
                    description: result.message,
                });
                refreshProducts();
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: result.message,
                });
            }
        });
    };

    const handleAuditStock = (e: React.MouseEvent, productId: string) => {
        e.stopPropagation();
        if (!user) return;
        startTransition(async () => {
            const result = await auditProductStockAction(productId, user.name);
            if (result.success) {
                toast({
                    title: '¡Éxito!',
                    description: result.message,
                });
                refreshProducts();
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: result.message,
                });
            }
        });
    };

    const handleClearAudit = (e: React.MouseEvent, productId: string) => {
        e.stopPropagation();
        startTransition(async () => {
            const result = await clearProductAuditAction(productId);
            if (result.success) {
                toast({
                    title: '¡Éxito!',
                    description: result.message,
                });
                refreshProducts();
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: result.message,
                });
            }
        });
    };

    const handlePaginationChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', String(newPage));
        router.push(`${pathname}?${params.toString()}`);
    }

    const handleItemsPerPageChange = (value: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('limit', String(value));
        params.set('page', '1'); // Reset to first page
        router.push(`${pathname}?${params.toString()}`);
    }

    const handleRowClick = (product: Product) => {
        setSelectedProductId(product.id);
    };

    const handleDialogChange = (open: boolean) => {
        if (!open) {
            setSelectedProductId(null);
        }
    };

    const clearFilters = () => {
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('limit', String(itemsPerPage));
        router.push(`${pathname}?${params.toString()}`);
        
        // Reset local state
        setSearchQuery('');
        setSelectedCategory('all');
        setSelectedRotation('all');
        setSelectedVendedor('all');
        setMinStock('');
        setHasPending(false);
        setHasReservations(false);
        setOnlyAudited(false);
    };

    const canEdit = user?.role === 'admin' || user?.role === 'plataformas' || user?.role === 'logistics';
    const canDelete = user?.role === 'admin';
    const canAudit = user?.role === 'admin' || user?.role === 'logistics';

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
        const dataToExport = initialProducts.flatMap(p => {
            const baseData = {
                'Categoría': initialCategoryNames[p.categoryId] || 'Desconocida',
                'Rotación': p.rotationCategoryName || 'N/A',
                'Stock Pendiente': p.pendingStock || 0,
                'Stock Averiado': p.damagedStock || 0,
                'Costo': user?.role === 'admin' ? p.cost : undefined,
                'Proveedor': initialSupplierNames[p.vendorId] || 'Desconocido',
                'Fecha Compra': p.purchaseDate ? format(new Date(p.purchaseDate), 'yyyy-MM-dd') : '',
                'Link de Contenido': p.contentLink || '',
            };

            if (p.productType === 'variable' && p.variants && p.variants.length > 0) {
                return p.variants.map(variant => ({
                    'Nombre': `${p.name} - ${variant.name}`,
                    'SKU': variant.sku,
                    'Tipo': 'variable',
                    ...baseData,
                    'Stock Físico': variant.stock,
                    'Precio Dropshipping': variant.priceDropshipping,
                    'Precio x Mayor': variant.priceWholesale,
                }));
            } else {
                return {
                    'Nombre': p.name,
                    'SKU': p.sku || 'N/A',
                    'Tipo': 'simple',
                    ...baseData,
                    'Stock Físico': p.stock,
                    'Precio Dropshipping': p.priceDropshipping,
                    'Precio x Mayor': p.priceWholesale,
                };
            }
        });

        // If user is not admin, remove the Cost property from all objects
        if (user?.role !== 'admin') {
            dataToExport.forEach(item => delete (item as any).Costo);
        }
    
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
        XLSX.writeFile(workbook, `Productos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      };

      const calculateAvailableStock = (product: Product, variantId?: string) => {
        const totalReserved = product.reservations?.reduce((sum, res) => {
            if (variantId) {
                // If checking a variant, only count reservations for that variant
                return res.variantId === variantId ? sum + res.quantity : sum;
            }
            if (product.productType === 'simple') {
                // If simple product, count all reservations
                return sum + res.quantity;
            }
            // For a variable product's total, sum all its variant reservations
            return sum + res.quantity;
        }, 0) || 0;
        
        let physicalStock = product.stock;
        if (variantId && product.variants) {
            physicalStock = product.variants.find(v => v.id === variantId)?.stock || 0;
        }

        return physicalStock - totalReserved;
    };


    return (
        <TooltipProvider>
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Catálogo de Productos</h1>
              <p className="text-muted-foreground">Navega y gestiona tus listados de productos.</p>
            </div>
            <div className={cn(!canEdit && "opacity-50 pointer-events-none")}>
                <AddProductForm onProductAdded={refreshProducts} />
            </div>
          </div>

          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4">
                <h3 className="font-semibold text-lg">Filtros</h3>
                <Button variant="ghost" onClick={clearFilters}>Limpiar Filtros</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                            {Object.entries(initialCategoryNames).map(([id, name]) => (
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
                    <Label htmlFor="vendedor">Vendedor con Reservas</Label>
                    <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
                        <SelectTrigger id="vendedor"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los Vendedores</SelectItem>
                            {vendedores.map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="min-stock">Stock Mínimo</Label>
                    <Input id="min-stock" type="number" placeholder="Ej: 10" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
                </div>
            </div>
             <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center space-x-2">
                    <Switch id="pending-stock" checked={hasPending} onCheckedChange={setHasPending} />
                    <Label htmlFor="pending-stock">Mostrar solo con stock pendiente</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="reserved-stock" checked={hasReservations} onCheckedChange={setHasReservations} />
                    <Label htmlFor="reserved-stock">Mostrar solo con stock reservado</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="audited-filter" checked={onlyAudited} onCheckedChange={setOnlyAudited} />
                    <Label htmlFor="audited-filter">Mostrar solo auditados</Label>
                </div>
            </div>
          </div>


          <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div className="space-y-1.5">
                        <CardTitle>Todos los Productos</CardTitle>
                        <CardDescription>Una lista de todos los productos en tu catálogo.</CardDescription>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Settings className="mr-2 h-4 w-4" />
                                Opciones
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!canEdit}>
                                <ImportProductsDialog onImportSuccess={refreshProducts} />
                            </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportExcel}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Exportar a Excel
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px] hidden sm:table-cell" />
                            <TableHead>Nombre</TableHead>
                            <TableHead>Bodega</TableHead>
                            <TableHead>Rotación</TableHead>
                            <TableHead>Auditoría</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead>Disponible</TableHead>
                            <TableHead>Pendiente</TableHead>
                            <TableHead>Averiado</TableHead>
                            <TableHead>Precio</TableHead>
                            <TableHead className="w-[50px]"><span className="sr-only">Acciones</span></TableHead>
                            <TableHead className="w-[50px] text-right pr-4"><span className="sr-only">Expandir</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={14}>
                                        <Skeleton className="h-16 w-full" />
                                    </TableCell>
                                </TableRow>
                            ))}
                            </>
                        ) : initialProducts.length > 0 ? (
                            initialProducts.map((product) => (
                                <React.Fragment key={product.id}>
                                    <TableRow 
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => handleRowClick(product)}
                                    >
                                        <TableCell className="w-[80px] hidden sm:table-cell">
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
                                            {warehouses.find(w => w.id === product.warehouseId)?.name || 'N/A'}
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
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {product.lastAuditedAt ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="relative flex items-center" onClick={(e) => e.stopPropagation()}>
                                                                <Check className="h-5 w-5 text-green-500" />
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <div className="p-2 space-y-2 text-center">
                                                                <p>Auditado por {product.lastAuditedBy} el {formatToTimeZone(new Date(product.lastAuditedAt), 'dd/MM/yyyy HH:mm')}</p>
                                                                {canAudit && <Button variant="outline" size="sm" onClick={(e) => handleAuditStock(e, product.id)} disabled={isProcessing}>Auditar de Nuevo</Button>}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    canAudit ? (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8"
                                                                onClick={(e) => handleAuditStock(e, product.id)}
                                                                disabled={isProcessing}
                                                            >
                                                                <ShieldCheck className="h-5 w-5 text-muted-foreground hover:text-blue-600" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>Marcar como auditado</p></TooltipContent>
                                                    </Tooltip>
                                                    ) : (
                                                        <ShieldCheck className="h-5 w-5 text-muted-foreground/30" />
                                                    )
                                                )}

                                                {product.lastAuditedAt && user?.role === 'admin' && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Limpiar Auditoría?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Esta acción marcará el producto como no auditado. Deberá ser verificado de nuevo.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={(e) => handleClearAudit(e, product.id)}>Limpiar</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{product.sku}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{initialCategoryNames[product.categoryId] || 'Desconocida'}</Badge>
                                        </TableCell>
                                        <TableCell>{product.stock}</TableCell>
                                        <TableCell className="font-semibold text-green-600">
                                            {calculateAvailableStock(product)}
                                        </TableCell>
                                        <TableCell className="text-orange-500 font-semibold">{product.pendingStock || 0}</TableCell>
                                        <TableCell className="text-destructive font-semibold">{product.damagedStock || 0}</TableCell>
                                        <TableCell>
                                            {(product.productType === 'simple' && product.priceDropshipping) ? `$${product.priceDropshipping.toFixed(0)}` : '--'}
                                        </TableCell>
                                        <TableCell className="w-[50px]" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost" disabled={!canEdit}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Menú de acciones</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    <EditProductForm product={product} onProductUpdated={refreshProducts}>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>
                                                    </EditProductForm>
                                                    {canDelete && (
                                                        <>
                                                        <DropdownMenuSeparator />
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                                                    Eliminar
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Esta acción eliminará el producto y sus reservas asociadas. Se creará un registro de "Eliminación" en el historial de movimientos, pero los movimientos pasados (entradas, salidas) se conservarán. Esta acción no se puede deshacer.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                        onClick={(e) => handleDeleteProduct(e, product.id)}
                                                                        disabled={isProcessing}
                                                                    >
                                                                        {isProcessing ? "Eliminando..." : "Eliminar"}
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                        <TableCell className="w-[50px] pr-4 text-right">
                                            {product.productType === 'variable' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleToggleRow(product.id);
                                                    }}
                                                  >
                                                    <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform duration-200", expandedRow === product.id && "rotate-180")} />
                                                  </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    {product.productType === 'variable' && expandedRow === product.id && (
                                        <TableRow className="bg-muted/20 hover:bg-muted/30">
                                            <TableCell colSpan={14}>
                                                <div className="p-4">
                                                    <h4 className="font-semibold mb-2 ml-4 text-sm">Variantes</h4>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="hover:bg-transparent">
                                                                <TableHead>Nombre</TableHead>
                                                                <TableHead>SKU</TableHead>
                                                                <TableHead>Precio</TableHead>
                                                                <TableHead>Stock Físico</TableHead>
                                                                <TableHead>Stock Disponible</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                        {product.variants?.map((variant) => (
                                                            <TableRow key={variant.id} className="border-b-0 hover:bg-transparent">
                                                                <TableCell>{variant.name}</TableCell>
                                                                <TableCell>{variant.sku}</TableCell>
                                                                <TableCell>${variant.priceDropshipping.toFixed(0)}</TableCell>
                                                                <TableCell>{variant.stock}</TableCell>
                                                                <TableCell className="font-semibold text-green-600">
                                                                    {calculateAvailableStock(product, variant.id)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={14} className="text-center h-24">
                                    No se encontraron productos con los filtros actuales.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter>
                 <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePaginationChange}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={handleItemsPerPageChange}
                />
            </CardFooter>
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

interface PaginationControlsProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    itemsPerPage: number;
    onItemsPerPageChange: (value: number) => void;
}

function PaginationControls({ currentPage, totalPages, onPageChange, itemsPerPage, onItemsPerPageChange }: PaginationControlsProps) {
    if (totalPages <= 1 && currentPage === 1) return null;
    
    return (
        <div className="flex items-center justify-end space-x-6 lg:space-x-8 w-full">
            <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Filas por página</p>
                <Select
                    value={`${itemsPerPage}`}
                    onValueChange={(value) => onItemsPerPageChange(Number(value))}
                >
                    <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={itemsPerPage} />
                    </SelectTrigger>
                    <SelectContent side="top">
                        {[10, 20, 50, 100].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                Página {currentPage} de {totalPages > 0 ? totalPages : 1}
            </div>
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    <span className="sr-only">Ir a la página anterior</span>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                >
                    <span className="sr-only">Ir a la página siguiente</span>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};
    
