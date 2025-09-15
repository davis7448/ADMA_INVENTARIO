
"use client";

import { useState, useMemo } from 'react';
import type { PendingInventoryItem, Product } from '@/lib/types';
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
import Image from 'next/image';
import { format, startOfDay, endOfDay } from 'date-fns';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from './ui/command';
import { Calendar } from './ui/calendar';
import type { DateRange } from 'react-day-picker';
import { cn, formatToTimeZone } from '@/lib/utils';
import { Check, ChevronsUpDown, Calendar as CalendarIcon, X } from 'lucide-react';
import { Label } from './ui/label';

interface PendingInventoryContentProps {
    initialPendingItems: PendingInventoryItem[];
    allProducts: Product[];
}

interface GroupedByProduct {
    [key: string]: {
        productInfo: Pick<PendingInventoryItem, 'productName' | 'productSku' | 'productImageUrl'>;
        totalPending: number;
        exceptions: {
            trackingNumber: string;
            quantity: number;
            date: string;
            dispatchId: string;
        }[];
    };
}


export function PendingInventoryContent({ initialPendingItems, allProducts }: PendingInventoryContentProps) {
    const [pendingItems] = useState<PendingInventoryItem[]>(initialPendingItems);

    // Filter states
    const [filterProductId, setFilterProductId] = useState<string>('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [filterTrackingNumbers, setFilterTrackingNumbers] = useState('');
    const [comboboxOpen, setComboboxOpen] = useState(false);

    const groupedAndFilteredItems = useMemo(() => {
        let items = [...pendingItems];
        const trackingList = filterTrackingNumbers.split('\n').map(t => t.trim()).filter(Boolean);

        if (filterProductId) {
            items = items.filter(item => item.productId === filterProductId);
        }

        if (dateRange?.from) {
            items = items.filter(item => new Date(item.date) >= startOfDay(dateRange.from!));
        }
        if (dateRange?.to) {
            items = items.filter(item => new Date(item.date) <= endOfDay(dateRange.to!));
        }
        if (trackingList.length > 0) {
            items = items.filter(item => trackingList.includes(item.trackingNumber));
        }
        
        // Group by product ID
        const grouped = items.reduce<GroupedByProduct>((acc, item) => {
            if (!acc[item.productId]) {
              acc[item.productId] = {
                productInfo: {
                    productName: item.productName,
                    productSku: item.productSku,
                    productImageUrl: item.productImageUrl,
                },
                totalPending: 0,
                exceptions: [],
              };
            }
            acc[item.productId].totalPending += item.quantity;
            acc[item.productId].exceptions.push({
                trackingNumber: item.trackingNumber,
                quantity: item.quantity,
                date: item.date,
                dispatchId: item.dispatchId,
            });
            return acc;
        }, {});
        
        return grouped;

    }, [pendingItems, filterProductId, dateRange, filterTrackingNumbers]);
    
    const sortedProductIds = useMemo(() => {
        // Sort products by name for consistent ordering
        return Object.keys(groupedAndFilteredItems).sort((a, b) => {
            const nameA = groupedAndFilteredItems[a].productInfo.productName.toLowerCase();
            const nameB = groupedAndFilteredItems[b].productInfo.productName.toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });
    }, [groupedAndFilteredItems]);


    const clearFilters = () => {
        setFilterProductId('');
        setDateRange(undefined);
        setFilterTrackingNumbers('');
    };

    const hasActiveFilters = filterProductId || dateRange || filterTrackingNumbers;

    const renderFilters = () => (
        <div className="mb-6 space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Product Filter */}
                <div className="space-y-2">
                    <Label>Filtrar por producto</Label>
                    <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={comboboxOpen} className="w-full justify-between">
                                {filterProductId ? allProducts.find((p) => p.id === filterProductId)?.name : "Seleccionar producto..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Buscar producto..." />
                                <CommandEmpty>No se encontró el producto.</CommandEmpty>
                                <CommandGroup>
                                    {allProducts.map((p) => (
                                        <CommandItem key={p.id} value={p.name} onSelect={() => { setFilterProductId(p.id === filterProductId ? '' : p.id); setComboboxOpen(false); }}>
                                            <Check className={cn("mr-2 h-4 w-4", filterProductId === p.id ? "opacity-100" : "opacity-0")} />
                                            {p.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Date Range Filter */}
                 <div className="space-y-2">
                    <Label>Filtrar por fecha</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Rango de fechas</span>)}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Tracking Numbers Filter */}
                <div className="space-y-2">
                    <Label htmlFor="tracking-filter">Filtrar por guías (una por línea)</Label>
                    <Textarea
                        id="tracking-filter"
                        placeholder="GUIA001\nGUIA002\nGUIA003"
                        value={filterTrackingNumbers}
                        onChange={(e) => setFilterTrackingNumbers(e.target.value)}
                        rows={3}
                    />
                </div>
            </div>
            {hasActiveFilters && (
                <div className="flex items-center gap-4 mt-4">
                    <Button variant="ghost" onClick={clearFilters}>
                        <X className="mr-2 h-4 w-4" />
                        Limpiar filtros
                    </Button>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Inventario Pendiente</h1>
                <p className="text-muted-foreground">
                    Productos que no fueron despachados y están a la espera de resolución.
                </p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Productos en Estado Pendiente</CardTitle>
                    <CardDescription>
                        Esta lista muestra los productos con stock pendiente. Expande cada uno para ver las guías de excepción asociadas.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {renderFilters()}
                    {sortedProductIds.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {sortedProductIds.map((productId) => {
                                const group = groupedAndFilteredItems[productId];
                                return (
                                <AccordionItem value={productId} key={productId}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4 gap-4">
                                            <div className="flex items-center gap-4 flex-1">
                                                <Image
                                                    src={group.productInfo.productImageUrl}
                                                    alt={group.productInfo.productName}
                                                    width={64}
                                                    height={64}
                                                    className="rounded-md object-cover"
                                                />
                                                <div className="text-left">
                                                    <p className="font-semibold">{group.productInfo.productName}</p>
                                                    <p className="text-sm text-muted-foreground">{group.productInfo.productSku}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-muted-foreground">Pendientes</p>
                                                <p className="text-2xl font-bold">{group.totalPending}</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="p-4 bg-muted/50 rounded-md">
                                            <h4 className="font-semibold mb-2">Desglose de Guías de Excepción</h4>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Guía de Excepción</TableHead>
                                                        <TableHead>ID Despacho Original</TableHead>
                                                        <TableHead>Fecha Despacho</TableHead>
                                                        <TableHead className="text-right">Cantidad Pendiente</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.exceptions.map((ex, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell className="font-mono">{ex.trackingNumber}</TableCell>
                                                            <TableCell>{ex.dispatchId}</TableCell>
                                                            <TableCell>{formatToTimeZone(new Date(ex.date), 'dd/MM/yyyy')}</TableCell>
                                                            <TableCell className="text-right font-medium">{ex.quantity}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                                );
                            })}
                        </Accordion>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">
                           {hasActiveFilters ? "No se encontraron resultados para los filtros seleccionados." : "No hay productos en el inventario pendiente."}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
