

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
import { Badge } from '@/components/ui/badge';
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

interface GroupedByTrackingNumber {
    [key: string]: {
      items: PendingInventoryItem[];
      date: string;
      isCompound: boolean;
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
        
        // Group by tracking number
        const grouped = items.reduce<GroupedByTrackingNumber>((acc, item) => {
            if (!acc[item.trackingNumber]) {
              acc[item.trackingNumber] = {
                items: [],
                date: item.date,
                isCompound: false
              };
            }
            acc[item.trackingNumber].items.push(item);
            return acc;
        }, {});
        
        // Determine if it's compound after grouping
        Object.keys(grouped).forEach(key => {
            grouped[key].isCompound = grouped[key].items.length > 1;
        });

        return grouped;

    }, [pendingItems, filterProductId, dateRange, filterTrackingNumbers]);
    
    const sortedTrackingNumbers = useMemo(() => {
        return Object.keys(groupedAndFilteredItems).sort((a, b) => {
            const dateA = new Date(groupedAndFilteredItems[a].date).getTime();
            const dateB = new Date(groupedAndFilteredItems[b].date).getTime();
            return dateB - dateA;
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
                        Esta lista muestra las guías de excepción. Expande cada una para ver los productos pendientes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {renderFilters()}
                    {sortedTrackingNumbers.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {sortedTrackingNumbers.map((trackingNumber) => {
                                const group = groupedAndFilteredItems[trackingNumber];
                                return (
                                <AccordionItem value={trackingNumber} key={trackingNumber}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <div className="text-left font-semibold">
                                                <span>Guía: </span>
                                                <Badge variant="secondary">{trackingNumber}</Badge>
                                                {group.isCompound && <Badge variant="outline" className="ml-2">Compuesto</Badge>}
                                            </div>
                                            <div className="text-right text-sm text-muted-foreground">
                                                {formatToTimeZone(new Date(group.date), 'dd/MM/yyyy')}
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="p-4 bg-muted/50 rounded-md">
                                            <h4 className="font-semibold mb-2">Productos en esta Guía</h4>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-20">Imagen</TableHead>
                                                        <TableHead>Producto</TableHead>
                                                        <TableHead>SKU</TableHead>
                                                        <TableHead>ID Despacho Original</TableHead>
                                                        <TableHead className="text-right">Cantidad</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.items.map((item) => (
                                                        <TableRow key={item.id}>
                                                            <TableCell>
                                                                <Image
                                                                    src={item.productImageUrl}
                                                                    alt={item.productName}
                                                                    width={48}
                                                                    height={48}
                                                                    className="rounded-md object-cover"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="font-medium">{item.productName}</TableCell>
                                                            <TableCell>{item.productSku}</TableCell>
                                                            <TableCell>{item.dispatchId}</TableCell>
                                                            <TableCell className="text-right font-medium">{item.quantity}</TableCell>
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
