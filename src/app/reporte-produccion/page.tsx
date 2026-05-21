"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { CalendarIcon, Download, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import { getDashboardRawData, getWarehouses } from '@/lib/api';
import { computeProductionReport, type ProductionReportData } from '@/lib/production-utils';
import type { DashboardRawData } from '@/lib/dashboard-utils';

const WEEKS = ['S1', 'S2', 'S3', 'S4', 'S5'] as const;

const chartConfig = {
  despachado: { label: 'Despachado', color: 'hsl(var(--chart-1))' },
  devoluciones: { label: 'Devoluciones', color: 'hsl(var(--chart-2))' },
  averias: { label: 'Averías', color: 'hsl(var(--chart-3))' },
  estimacion: { label: 'Estimación', color: 'hsl(var(--chart-4))' },
};

function ReporteProduccionContent() {
  const searchParams = useSearchParams();
  const { user, effectiveWarehouseId: authEffectiveWarehouseId } = useAuth();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const to = new Date();
    const from = addDays(to, -59);
    return { from, to };
  });

  const [rawData, setRawData] = useState<DashboardRawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [allWarehouses, setAllWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>(
    searchParams.get('warehouse') || undefined
  );

  const effectiveWarehouseId = user?.role === 'admin' ? selectedWarehouse : authEffectiveWarehouseId;
  const warehouseId = searchParams.get('warehouse') || effectiveWarehouseId || undefined;

  useEffect(() => {
    if (user?.role === 'admin') {
      getWarehouses().then(setAllWarehouses).catch(() => setAllWarehouses([]));
    }
  }, [user?.role]);

  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;
    setLoading(true);
    getDashboardRawData({ warehouseId, dateRange: { from: dateRange.from, to: dateRange.to } })
      .then(setRawData)
      .catch(err => { console.error('Error fetching production data:', err); setRawData(null); })
      .finally(() => setLoading(false));
  }, [warehouseId, dateRange]);

  const reportData: ProductionReportData = useMemo(() => {
    if (!rawData) return {};
    return computeProductionReport(rawData, { warehouseId });
  }, [rawData, warehouseId]);

  const sortedMonths = Object.keys(reportData).sort((a, b) => b.localeCompare(a));
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function exportMonth(month: string) {
    const monthData = reportData[month];
    const [year, m] = month.split('-');
    const monthLabel = format(new Date(Number(year), Number(m) - 1, 1), 'MMMM yyyy', { locale: es });

    const rows: Record<string, string | number>[] = [];

    // Header row with totals
    rows.push({
      Producto: `TOTAL — ${monthLabel}`,
      Semana: '',
      Despachado: monthData.totales.despachado,
      Devoluciones: monthData.totales.devoluciones,
      Averías: monthData.totales.averias,
      Estimación: monthData.totales.estimacion,
    });

    // Per-product rows
    const products = Object.values(monthData.porProducto).sort((a, b) => b.despachado - a.despachado);
    for (const prod of products) {
      rows.push({
        Producto: prod.name,
        Semana: 'TOTAL',
        Despachado: prod.despachado,
        Devoluciones: prod.devoluciones,
        Averías: prod.averias,
        Estimación: prod.estimacion,
      });
      for (const semana of WEEKS) {
        const wk = prod.semanas[semana];
        if (!wk) continue;
        rows.push({
          Producto: prod.name,
          Semana: semana,
          Despachado: wk.despachado,
          Devoluciones: wk.devoluciones,
          Averías: wk.averias,
          Estimación: wk.estimacion,
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 40 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, monthLabel.slice(0, 31));
    XLSX.writeFile(wb, `produccion_${month}.xlsx`);
  }

  async function exportMonthPDF(month: string) {
    const [html2canvas, { default: jsPDF }] = await Promise.all([
      import('html2canvas').then(m => m.default),
      import('jspdf'),
    ]);
    await import('jspdf-autotable');

    const monthData = reportData[month];
    const [year, m] = month.split('-');
    const monthLabel = format(new Date(Number(year), Number(m) - 1, 1), 'MMMM yyyy', { locale: es });
    const products = Object.values(monthData.porProducto).sort((a, b) => b.despachado - a.despachado);

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 14;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Reporte de Producción — ${monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}`, pageW / 2, y, { align: 'center' });
    y += 8;

    // Totals row
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const { totales } = monthData;
    doc.text(
      `Despachado: ${totales.despachado}   Devoluciones: ${totales.devoluciones}   Averías: ${totales.averias}   Estimación: ${totales.estimacion}`,
      pageW / 2, y, { align: 'center' }
    );
    y += 6;

    // Chart capture
    const chartEl = chartRefs.current[month];
    if (chartEl) {
      const canvas = await html2canvas(chartEl, { scale: 2, backgroundColor: '#ffffff', logging: false });
      const imgData = canvas.toDataURL('image/png');
      const imgH = 55;
      const imgW = (canvas.width / canvas.height) * imgH;
      const imgX = (pageW - imgW) / 2;
      doc.addImage(imgData, 'PNG', imgX, y, imgW, imgH);
      y += imgH + 6;
    }

    // Per-product table
    const head = [['Producto', 'Semana', 'Despachado', 'Devoluciones', 'Averías', 'Estimación', 'Δ Desp.']];
    const body: (string | number)[][] = [];

    for (const prod of products) {
      body.push([prod.name, 'TOTAL', prod.despachado, prod.devoluciones, prod.averias, prod.estimacion, '']);
      let prevDesp: number | null = null;
      for (const semana of WEEKS) {
        const wk = prod.semanas[semana];
        if (!wk) continue;
        const delta = prevDesp !== null && prevDesp !== 0
          ? `${wk.despachado >= prevDesp ? '▲' : '▼'} ${Math.abs(Math.round(((wk.despachado - prevDesp) / prevDesp) * 100))}%`
          : '';
        body.push([prod.name, semana, wk.despachado, wk.devoluciones, wk.averias, wk.estimacion, delta]);
        prevDesp = wk.despachado;
      }
    }

    // @ts-ignore
    doc.autoTable({
      head,
      body,
      startY: y,
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 70 },
        6: { halign: 'center' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 6) {
          const val = String(data.cell.raw);
          if (val.startsWith('▲')) data.cell.styles.textColor = [22, 163, 74];
          if (val.startsWith('▼')) data.cell.styles.textColor = [220, 38, 38];
        }
        if (data.section === 'body' && data.column.index === 1 && data.cell.raw === 'TOTAL') {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    doc.save(`produccion_${month}.pdf`);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Reporte de Producción</h1>
        <div className="flex gap-2 flex-wrap">
          {user?.role === 'admin' && (
            <Select
              value={selectedWarehouse || ''}
              onValueChange={v => setSelectedWarehouse(v === 'all' ? undefined : v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Seleccionar bodega" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las bodegas</SelectItem>
                {allWarehouses.map(wh => (
                  <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('w-full sm:w-[260px] justify-start text-left font-normal', !dateRange && 'text-muted-foreground')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'LLL dd, y', { locale: es })} -{' '}
                      {format(dateRange.to, 'LLL dd, y', { locale: es })}
                    </>
                  ) : format(dateRange.from, 'LLL dd, y', { locale: es })
                ) : <span>Seleccionar rango</span>}
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

      {loading ? (
        <div className="space-y-6">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
              <CardContent><Skeleton className="h-40 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : sortedMonths.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay datos de producción en el rango seleccionado.
          </CardContent>
        </Card>
      ) : (
        sortedMonths.map(month => {
          const monthData = reportData[month];
          const { totales } = monthData;
          const products = Object.entries(monthData.porProducto).sort(([, a], [, b]) => b.despachado - a.despachado);

          // Weekly chart data
          const chartData = WEEKS.map(semana => {
            const entry: Record<string, string | number> = { semana };
            for (const [, prod] of products.slice(0, 5)) {
              const wk = prod.semanas[semana];
              entry[`${prod.name.slice(0, 20)}_desp`] = wk?.despachado || 0;
            }
            entry.devoluciones = Object.values(monthData.porProducto).reduce((s, p) => s + (p.semanas[semana]?.devoluciones || 0), 0);
            entry.averias = Object.values(monthData.porProducto).reduce((s, p) => s + (p.semanas[semana]?.averias || 0), 0);
            entry.estimacion = Object.values(monthData.porProducto).reduce((s, p) => s + (p.semanas[semana]?.estimacion || 0), 0);
            return entry;
          });

          const [year, m] = month.split('-');
          const monthLabel = format(new Date(Number(year), Number(m) - 1, 1), 'MMMM yyyy', { locale: es });

          return (
            <Card key={month}>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="capitalize">{monthLabel}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Badge variant="outline">Despachado: {totales.despachado}</Badge>
                    <Badge variant="outline">Devoluciones: {totales.devoluciones}</Badge>
                    <Badge variant="outline">Averías: {totales.averias}</Badge>
                    <Badge variant="secondary">Estimación: {totales.estimacion}</Badge>
                    <Button variant="outline" size="sm" onClick={() => exportMonth(month)}>
                      <Download className="h-4 w-4 mr-1" />
                      Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportMonthPDF(month)}>
                      <FileText className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Estimación = Despachado + Averías − Devoluciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Weekly Trend Chart */}
                <div ref={el => { chartRefs.current[month] = el; }}>
                <ChartContainer config={chartConfig} className="h-[200px]">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="semana" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="devoluciones" name="Devoluciones" fill="hsl(var(--chart-2))" radius={[2,2,0,0]} />
                    <Bar dataKey="averias" name="Averías" fill="hsl(var(--chart-3))" radius={[2,2,0,0]} />
                    <Bar dataKey="estimacion" name="Estimación" fill="hsl(var(--chart-4))" radius={[2,2,0,0]} />
                  </BarChart>
                </ChartContainer>
                </div>

                {/* Per-product table with weekly accordion */}
                <Accordion type="multiple" className="w-full space-y-2">
                  {products.map(([productId, prod]) => (
                    <AccordionItem key={productId} value={productId} className="border rounded-lg px-4">
                      <AccordionTrigger>
                        <div className="flex justify-between items-center w-full pr-2 gap-4 flex-wrap">
                          <span className="font-medium text-left">{prod.name}</span>
                          <div className="flex gap-2 text-sm flex-wrap">
                            <span className="text-muted-foreground">Desp: <strong>{prod.despachado}</strong></span>
                            <span className="text-muted-foreground">Dev: <strong>{prod.devoluciones}</strong></span>
                            <span className="text-muted-foreground">Av: <strong>{prod.averias}</strong></span>
                            <Badge variant="secondary">Est: {prod.estimacion}</Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pt-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Semana</TableHead>
                                <TableHead className="text-right">Despachado</TableHead>
                                <TableHead className="text-right">Devoluciones</TableHead>
                                <TableHead className="text-right">Averías</TableHead>
                                <TableHead className="text-right">Estimación</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {WEEKS.filter(w => prod.semanas[w]).map(semana => {
                                const wk = prod.semanas[semana];
                                return (
                                  <TableRow key={semana}>
                                    <TableCell className="font-medium">{semana}</TableCell>
                                    <TableCell className="text-right">{wk.despachado}</TableCell>
                                    <TableCell className="text-right">{wk.devoluciones}</TableCell>
                                    <TableCell className="text-right">{wk.averias}</TableCell>
                                    <TableCell className="text-right font-semibold">{wk.estimacion}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

export default function ReporteProduccion() {
  return <ReporteProduccionContent />;
}
