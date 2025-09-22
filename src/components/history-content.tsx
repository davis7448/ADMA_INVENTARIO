
"use client";

import { useState, useMemo, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { Badge } from '@/components/ui/badge';
import type { InventoryMovement, Product, DispatchOrder, Platform, Carrier } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Calendar as CalendarIcon, Check, ChevronsUpDown, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { generatePickingListPDF } from '@/lib/pdf';
import { formatToTimeZone, cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getInventoryMovements, getDispatchOrders } from '@/lib/api';


interface HistoryContentProps {
    initialMovements: InventoryMovement[];
    movementsTotalPages: number;
    initialDispatchOrders: DispatchOrder[];
    ordersTotalPages: number;
    allProducts: Product[];
    allPlatforms: Platform[];
    allCarriers: Carrier[];
}

export function HistoryContent({
    initialMovements,
    movementsTotalPages,
    initialDispatchOrders,
    ordersTotalPages,
    allProducts,
    allPlatforms,
    allCarriers,
}: HistoryContentProps) {

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Filter states from URL
    const [filterPlatformId, setFilterPlatformId] = useState<string>(searchParams.get('platformId') || 'all');
    const [filterCarrierId, setFilterCarrierId] = useState<string>(searchParams.get('carrierId') || 'all');
    const [filterProductId, setFilterProductId] = useState<string>(searchParams.get('productId') || 'all');
    const [filterMovementType, setFilterMovementType] = useState<string>(searchParams.get('movementType') || 'all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        if (startDate && endDate) {
            return { from: new Date(startDate), to: new Date(endDate) };
        }
        return undefined;
    });
    const [productComboboxOpen, setProductComboboxOpen] = useState(false);

    // Pagination states from URL
    const movementsPage = Number(searchParams.get('movementsPage') || '1');
    const ordersPage = Number(searchParams.get('ordersPage') || '1');
    
    const applyFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        
        const updateParam = (key: string, value: string, defaultValue: string) => {
            if (value !== defaultValue) params.set(key, value); else params.delete(key);
        };
        
        updateParam('productId', filterProductId, 'all');
        updateParam('platformId', filterPlatformId, 'all');
        updateParam('carrierId', filterCarrierId, 'all');
        updateParam('movementType', filterMovementType, 'all');

        if (dateRange?.from) params.set('startDate', dateRange.from.toISOString()); else params.delete('startDate');
        if (dateRange?.to) params.set('endDate', dateRange.to.toISOString()); else params.delete('endDate');
        
        // When filters change, always go back to page 1 for both tabs
        params.set('movementsPage', '1');
        params.set('ordersPage', '1');

        router.push(`${pathname}?${params.toString()}`);
    };

    const handlePaginationChange = (type: 'movements' | 'orders', newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set(`${type}Page`, String(newPage));
        router.push(`${pathname}?${params.toString()}`);
    }

    const productsById = useMemo(() => allProducts.reduce((acc, p) => ({ ...acc, [p.id]: p }), {} as Record<string, Product>), [allProducts]);
    const platformNames = useMemo(() => allPlatforms.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>), [allPlatforms]);
    const carrierNames = useMemo(() => allCarriers.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>), [allCarriers]);

    const handleDownloadPdf = (order: DispatchOrder) => {
        const productsForPdf = order.products.map(p => ({ ...p, dispatchQuantity: p.quantity }));
        generatePickingListPDF(order.dispatchId, productsForPdf, platformNames[order.platformId] || 'N/A', carrierNames[order.carrierId] || 'N/A', new Date(order.date));
    };

    const handleExportMovementsExcel = async () => {
        const { movements } = await getInventoryMovements({ fetchAll: true });
        const flattenedData = movements.map(movement => ({
            'ID Movimiento': movement.movementId,
            'Fecha': formatToTimeZone(new Date(movement.date), "dd/MM/yyyy HH:mm"),
            'Tipo': movement.type,
            'Usuario': movement.userName || 'Sistema',
            'SKU Producto': productsById[movement.productId]?.sku || 'N/A',
            'Nombre Producto': movement.productName,
            'Plataforma': movement.platformId ? platformNames[movement.platformId] : 'N/A',
            'Transportadora': movement.carrierId ? carrierNames[movement.carrierId] : 'N/A',
            'Cantidad': movement.quantity,
            'Notas': movement.notes,
        }));

        const worksheet = XLSX.utils.json_to_sheet(flattenedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Movimientos");
        XLSX.writeFile(workbook, `Historial-Movimientos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const handleExportExcel = async () => {
        const { orders } = await getDispatchOrders({ fetchAll: true });
        const flattenedData = orders.flatMap(order => 
            order.products.map(product => ({
                'ID Despacho': order.dispatchId,
                'Fecha': formatToTimeZone(new Date(order.date), "dd/MM/yyyy HH:mm"),
                'Usuario': order.createdBy?.name || 'Sistema',
                'Plataforma': platformNames[order.platformId] || 'N/A',
                'Transportadora': carrierNames[order.carrierId] || 'N/A',
                'SKU Producto': product.sku,
                'Nombre Producto': product.name,
                'Cantidad': product.quantity,
            }))
        );

        const worksheet = XLSX.utils.json_to_sheet(flattenedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Despachos");
        XLSX.writeFile(workbook, `Historial-Despachos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    };

    const getMovementBadgeClass = (type: 'Entrada' | 'Salida' | 'Averia' | 'Anulado') => {
        switch (type) {
        case 'Entrada':
            return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
        case 'Salida':
            return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
        case 'Averia':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
        case 'Anulado':
            return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300';
        default:
            return '';
        }
    };

    const getDispatchStatusBadge = (status: 'Pendiente' | 'Despachada' | 'Parcial' | 'Anulada') => {
        switch (status) {
        case 'Pendiente':
            return <Badge variant="destructive">Pendiente</Badge>;
        case 'Despachada':
            return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Despachada</Badge>;
        case 'Parcial':
            return <Badge variant="secondary">Parcial</Badge>;
        case 'Anulada':
            return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300">Anulada</Badge>;
        default:
            return <Badge variant="outline">Desconocido</Badge>;
        }
    };

    const clearFilters = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('productId');
        params.delete('platformId');
        params.delete('carrierId');
        params.delete('movementType');
        params.delete('startDate');
        params.delete('endDate');
        params.set('movementsPage', '1');
        params.set('ordersPage', '1');
        router.push(`${pathname}?${params.toString()}`);
        
        setFilterPlatformId('all');
        setFilterCarrierId('all');
        setFilterProductId('all');
        setFilterMovementType('all');
        setDateRange(undefined);
    };

    const hasActiveFilters = filterPlatformId !== 'all' || filterCarrierId !== 'all' || filterProductId !== 'all' || filterMovementType !== 'all' || dateRange;

    const renderFilters = () => (
        <div className="mb-6 space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                    <Label>Filtrar por producto</Label>
                    <Popover open={productComboboxOpen} onOpenChange={setProductComboboxOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={productComboboxOpen} className="w-full justify-between">
                                {filterProductId !== 'all' ? allProducts.find((p) => p.id === filterProductId)?.name : "Todos los productos"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Buscar producto..." />
                                <CommandEmpty>No se encontró el producto.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem key="all" value="all" onSelect={() => { setFilterProductId('all'); setProductComboboxOpen(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", filterProductId === 'all' ? "opacity-100" : "opacity-0")} />
                                        Todos los productos
                                    </CommandItem>
                                    {allProducts.map((p) => (
                                        <CommandItem key={p.id} value={p.name} onSelect={() => { setFilterProductId(p.id); setProductComboboxOpen(false); }}>
                                            <Check className={cn("mr-2 h-4 w-4", filterProductId === p.id ? "opacity-100" : "opacity-0")} />
                                            {p.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="platform-filter">Plataforma</Label>
                    <Select value={filterPlatformId} onValueChange={setFilterPlatformId}>
                        <SelectTrigger id="platform-filter"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {allPlatforms.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="carrier-filter">Transportadora</Label>
                    <Select value={filterCarrierId} onValueChange={setFilterCarrierId}>
                        <SelectTrigger id="carrier-filter"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {allCarriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="movement-type-filter">Tipo de Movimiento</Label>
                    <Select value={filterMovementType} onValueChange={setFilterMovementType}>
                        <SelectTrigger id="movement-type-filter"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="Entrada">Entrada</SelectItem>
                            <SelectItem value="Salida">Salida</SelectItem>
                            <SelectItem value="Averia">Averia</SelectItem>
                            <SelectItem value="Anulado">Anulado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Rango de fechas</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Seleccionar rango</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
                 <Button onClick={applyFilters}>Aplicar Filtros</Button>
                 {hasActiveFilters && (
                    <Button variant="ghost" onClick={clearFilters}>
                        <X className="mr-2 h-4 w-4" />
                        Limpiar filtros
                    </Button>
                )}
            </div>
        </div>
    );
    
    interface PaginationControlsProps {
        currentPage: number;
        totalPages: number;
        onPageChange: (page: number) => void;
    }
    
    const PaginationControls = ({ currentPage, totalPages, onPageChange}: PaginationControlsProps) => {
        if (totalPages <= 1) return null;
        
        return (
            <div className="flex items-center justify-end space-x-6 lg:space-x-8 w-full">
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

    return (
        <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Historial de Inventario</h1>
            <p className="text-muted-foreground">Un registro de todas las transacciones de stock.</p>
        </div>

        {renderFilters()}

        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Movimientos Recientes</CardTitle>
                        <CardDescription>
                            Mostrando las últimas entradas y salidas de inventario.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleExportMovementsExcel}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Exportar a Excel
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID Mov.</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Plataforma</TableHead>
                            <TableHead>Transportadora</TableHead>
                            <TableHead className="text-center">Cantidad</TableHead>
                            <TableHead>Notas</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {initialMovements.length > 0 ? (
                        initialMovements.map((movement) => (
                        <TableRow key={movement.id}>
                            <TableCell className="font-mono text-xs">{movement.movementId || 'N/A'}</TableCell>
                            <TableCell className="font-medium">
                            {formatToTimeZone(new Date(movement.date), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell>{movement.productName}</TableCell>
                            <TableCell>
                            <Badge variant="outline" className={getMovementBadgeClass(movement.type)}>
                                {movement.type}
                            </Badge>
                            </TableCell>
                            <TableCell>{movement.userName || 'Sistema'}</TableCell>
                            <TableCell>{movement.platformId ? platformNames[movement.platformId] : 'N/A'}</TableCell>
                            <TableCell>{movement.carrierId ? carrierNames[movement.carrierId] : 'N/A'}</TableCell>
                            <TableCell className="text-center">{movement.quantity}</TableCell>
                            <TableCell className="text-muted-foreground">{movement.notes}</TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={9} className="text-center h-24">
                            No se encontraron movimientos para los filtros seleccionados.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </CardContent>
             <CardFooter>
                <PaginationControls 
                    currentPage={movementsPage} 
                    totalPages={movementsTotalPages}
                    onPageChange={(page) => handlePaginationChange('movements', page)}
                />
            </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Órdenes de Despacho Generadas</CardTitle>
                        <CardDescription>
                            Un historial de todos los picking lists generados.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleExportExcel}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Exportar a Excel
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {initialDispatchOrders.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full">
                        {initialDispatchOrders.map((order) => (
                            <AccordionItem value={order.id} key={order.id}>
                                <AccordionTrigger>
                                    <div className="flex justify-between items-center w-full pr-4">
                                        <div className="text-left">
                                            <p className="font-semibold">{order.dispatchId}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {formatToTimeZone(new Date(order.date), "dd/MM/yyyy HH:mm")} - {order.totalItems} items
                                            </p>
                                            {order.createdBy && <p className="text-xs text-muted-foreground">Creado por: {order.createdBy.name}</p>}
                                        </div>
                                        <div className="text-center px-4">
                                            {getDispatchStatusBadge(order.status)}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium">{platformNames[order.platformId] || 'N/A'}</p>
                                            <p className="text-sm text-muted-foreground">{carrierNames[order.carrierId] || 'N/A'}</p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="p-4 bg-muted/50 rounded-md grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="font-semibold mb-2">Productos de la Orden</h4>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Producto</TableHead>
                                                        <TableHead>SKU</TableHead>
                                                        <TableHead className="text-right">Cant. Pedida</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {order.products.map((p) => (
                                                        <TableRow key={p.productId + (p.variantId || '')}>
                                                            <TableCell>{p.name}</TableCell>
                                                            <TableCell>{p.sku}</TableCell>
                                                            <TableCell className="text-right">{p.quantity}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            {order.trackingNumbers && order.trackingNumbers.length > 0 && (
                                                <div>
                                                    <h4 className="font-semibold mb-2 text-green-600">Guías Despachadas</h4>
                                                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                                                        <ul className="space-y-1 text-sm font-mono text-green-800 dark:text-green-300">
                                                            {order.trackingNumbers.map((tn, index) => <li key={index}>{tn}</li>)}
                                                        </ul>
                                                    </div>
                                                </div>
                                            )}

                                            {order.exceptions && order.exceptions.length > 0 && (
                                                <div>
                                                    <h4 className="font-semibold mb-2 text-destructive">Excepciones (No Enviados)</h4>
                                                    {order.exceptions.map((ex, index) => (
                                                        <div key={index} className="mb-3">
                                                            <p className="text-sm font-semibold">Guía de Excepción: <span className="font-mono bg-destructive/10 px-2 py-1 rounded">{ex.trackingNumber}</span></p>
                                                            <Table>
                                                                <TableBody>
                                                                    {ex.products.map(p => (
                                                                        <TableRow key={p.productId + (p.variantId || '')}>
                                                                            <TableCell className="text-xs">{productsById[p.productId]?.name || 'Producto desconocido'}</TableCell>
                                                                            <TableCell className="text-right text-xs">Cant: {p.quantity}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {order.cancelledExceptions && order.cancelledExceptions.length > 0 && (
                                                <div>
                                                    <h4 className="font-semibold mb-2 text-gray-500">Anulaciones Registradas</h4>
                                                    {order.cancelledExceptions.map((ex, index) => (
                                                        <div key={index} className="mb-3">
                                                            <p className="text-sm font-semibold">Guía Anulada: <span className="font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{ex.trackingNumber}</span></p>
                                                            <Table>
                                                                <TableBody>
                                                                    {ex.products.map(p => (
                                                                        <TableRow key={p.productId + (p.variantId || '')}>
                                                                            <TableCell className="text-xs">{productsById[p.productId]?.name || 'Producto desconocido'}</TableCell>
                                                                            <TableCell className="text-right text-xs">Cant: {p.quantity}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex justify-end mt-4 col-span-full">
                                            <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(order)}>
                                                <Download className="mr-2 h-4 w-4" />
                                                Descargar PDF
                                            </Button>
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <div className="text-center text-muted-foreground py-8 h-24">
                        No se encontraron órdenes de despacho para los filtros seleccionados.
                    </div>
                )}
            </CardContent>
            <CardFooter>
                 <PaginationControls 
                    currentPage={ordersPage} 
                    totalPages={ordersTotalPages}
                    onPageChange={(page) => handlePaginationChange('orders', page)}
                />
            </CardFooter>
        </Card>
        </div>
    );
}
