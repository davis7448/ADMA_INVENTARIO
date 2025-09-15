
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

export function PendingInventoryContent({ initialPendingItems, allProducts }: PendingInventoryContentProps) {
    const [pendingItems] = useState<PendingInventoryItem[]>(initialPendingItems);

    // Filter states
    const [filterProductId, setFilterProductId] = useState<string>('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [filterTrackingNumbers, setFilterTrackingNumbers] = useState('');
    const [comboboxOpen, setComboboxOpen] = useState(false);

    const filteredItems = useMemo(() => {
        let items = [...pendingItems];
        const trackingList = filterTrackingNumbers.split('\n').map(t => t.trim()).filter(Boolean);

        if (filterProductId) {
            items = items.filter(item => item.id === filterProductId);
        }

        if (dateRange?.from || dateRange?.to || trackingList.length > 0) {
            items = items.map(item => {
                let filteredDetails = item.exceptionDetails;

                if (dateRange?.from) {
                    filteredDetails = filteredDetails.filter(detail => new Date(detail.date) >= startOfDay(dateRange.from!));
                }
                if (dateRange?.to) {
                    filteredDetails = filteredDetails.filter(detail => new Date(detail.date) <= endOfDay(dateRange.to!));
                }
                if (trackingList.length > 0) {
                    filteredDetails = filteredDetails.filter(detail => trackingList.includes(detail.trackingNumber));
                }

                return { ...item, exceptionDetails: filteredDetails };
            }).filter(item => item.exceptionDetails.length > 0); // Only keep items that still have details after filtering
        }
        
        return items;
    }, [pendingItems, filterProductId, dateRange, filterTrackingNumbers]);

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
                        Esta lista muestra los productos que se registraron como excepciones durante el despacho.
                        Usa los filtros para encontrar items específicos.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {renderFilters()}
                    {filteredItems.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                            {filteredItems.map((item) => (
                                <AccordionItem value={item.id} key={item.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between items-center w-full pr-4">
                                            <div className="flex items-center gap-4 text-left">
                                                <Image
                                                    src={item.imageUrl}
                                                    alt={item.name}
                                                    width={48}
                                                    height={48}
                                                    className="rounded-md object-cover"
                                                />
                                                <div>
                                                    <p className="font-semibold">{item.name}</p>
                                                    <p className="text-sm text-muted-foreground">{item.sku}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-muted-foreground">Total Pendiente</p>
                                                <p className="text-lg font-bold">{item.pendingStock}</p>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="p-4 bg-muted/50 rounded-md">
                                            <h4 className="font-semibold mb-2">Detalle de Excepciones</h4>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Fecha Despacho</TableHead>
                                                        <TableHead>ID Despacho</TableHead>
                                                        <TableHead>Guía Excepción</TableHead>
                                                        <TableHead className="text-right">Cantidad</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {item.exceptionDetails.map((detail, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell>{formatToTimeZone(new Date(detail.date), 'dd/MM/yyyy')}</TableCell>
                                                            <TableCell>{detail.dispatchId}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="secondary">{detail.trackingNumber}</Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium">{detail.quantity}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
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
