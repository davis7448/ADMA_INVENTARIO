"use client";

import { useMemo, useState } from 'react';
import { format, subDays, startOfMonth, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Users, UserPlus, CalendarDays, DollarSign, CalendarIcon, TrendingUp, Package } from 'lucide-react';
import { CommercialClient } from '@/types/commercial';
import { computeCrmMetrics } from '@/lib/crm-metrics';
import CrmAdditionsChart from '@/components/commercial/crm-additions-chart';
import CrmAdditionsByCommercialChart from '@/components/commercial/crm-additions-by-commercial-chart';
import CrmStatusChart from '@/components/commercial/crm-status-chart';
import CrmProductView from '@/components/commercial/crm-product-view';

type CrmMetricsViewProps = {
    clients: CommercialClient[];
    isDirector: boolean;
};

const salesFormatter = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export default function CrmMetricsView({ clients, isDirector }: CrmMetricsViewProps) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfDay(subDays(new Date(), 29)),
        to: new Date(),
    });

    const resolvedRange = useMemo(() => ({
        from: dateRange?.from ?? startOfDay(subDays(new Date(), 29)),
        to: dateRange?.to ?? new Date(),
    }), [dateRange]);

    const metrics = useMemo(
        () => computeCrmMetrics(clients, resolvedRange),
        [clients, resolvedRange],
    );

    const applyPreset = (preset: 'last30' | 'month' | 'all') => {
        const now = new Date();
        if (preset === 'last30') {
            setDateRange({ from: startOfDay(subDays(now, 29)), to: now });
        } else if (preset === 'month') {
            setDateRange({ from: startOfMonth(now), to: now });
        } else {
            // "Todo": desde la fecha del cliente más antiguo (o hace 2 años como respaldo).
            const dates = clients
                .map((c) => (c.created_at instanceof Date ? c.created_at : c.created_at?.toDate?.()))
                .filter(Boolean) as Date[];
            const earliest = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : subDays(now, 730);
            setDateRange({ from: startOfDay(earliest), to: now });
        }
    };

    return (
        <div className="space-y-6">
            {/* Filtro de rango de fechas */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                    Las <span className="font-medium text-foreground">altas</span> se calculan sobre el rango seleccionado. El resto de KPIs reflejan el estado actual.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => applyPreset('last30')}>30 días</Button>
                    <Button variant="outline" size="sm" onClick={() => applyPreset('month')}>Este mes</Button>
                    <Button variant="outline" size="sm" onClick={() => applyPreset('all')}>Todo</Button>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>{format(dateRange.from, 'dd MMM', { locale: es })} - {format(dateRange.to, 'dd MMM', { locale: es })}</>
                                    ) : (
                                        format(dateRange.from, 'dd MMM yyyy', { locale: es })
                                    )
                                ) : (
                                    <span>Elegir fechas</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={2}
                                locale={es}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{isDirector ? 'Total Clientes' : 'Mis Clientes'}</CardTitle>
                        <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalClients}</div>
                        <p className="text-xs text-muted-foreground">{metrics.additionsInRange} agregados en el rango</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nuevos este mes</CardTitle>
                        <UserPlus className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.newThisMonth}</div>
                        <p className="text-xs text-muted-foreground">Altas del mes en curso</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-indigo-600/10 border-purple-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Nuevos esta semana</CardTitle>
                        <CalendarDays className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.newThisWeek}</div>
                        <p className="text-xs text-muted-foreground">Altas de la semana actual</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-orange-600/10 border-amber-200/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas promedio</CardTitle>
                        <DollarSign className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{salesFormatter.format(Math.round(metrics.avgSales))}</div>
                        <p className="text-xs text-muted-foreground">Promedio de avg_sales por cliente</p>
                    </CardContent>
                </Card>
            </div>

            {/* Altas en el tiempo + por comercial */}
            <div className={`grid gap-4 ${isDirector ? 'lg:grid-cols-2' : ''}`}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="h-4 w-4 text-primary" /> Altas en el tiempo
                        </CardTitle>
                        <CardDescription>Clientes agregados por día en el rango seleccionado</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64">
                            <CrmAdditionsChart data={metrics.additionsByDay} />
                        </div>
                    </CardContent>
                </Card>

                {isDirector && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Altas por comercial</CardTitle>
                            <CardDescription>Quién registró más clientes en el rango (top 10)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                <CrmAdditionsByCommercialChart data={metrics.additionsByCommercial} />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Distribuciones */}
            <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Por etapa del pipeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="min-h-[180px]">
                            <CrmStatusChart data={metrics.byStatus.map((s) => ({ name: s.label, value: s.count }))} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Por categoría</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="min-h-[180px]">
                            <CrmStatusChart data={metrics.byCategory.map((c) => ({ name: c.name, value: c.count }))} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Por tipo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="min-h-[180px]">
                            <CrmStatusChart data={metrics.byType.map((t) => ({ name: t.name, value: t.count }))} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Por ciudad (top 8)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="min-h-[180px]">
                        <CrmStatusChart data={metrics.byCity.slice(0, 8).map((c) => ({ name: c.name, value: c.count }))} />
                    </div>
                </CardContent>
            </Card>

            {/* Producto por cliente + correos sin ficha (solo director/admin: lee todos los clientes y modificaciones) */}
            {isDirector && (
                <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 border-t pt-6">
                        <Package className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-bold tracking-tight">Producto por cliente</h2>
                    </div>
                    <CrmProductView range={resolvedRange} />
                </div>
            )}
        </div>
    );
}
