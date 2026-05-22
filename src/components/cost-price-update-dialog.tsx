"use client";

import { useMemo, useState, useTransition } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  applyCostPriceUpdateAction,
  previewCostPriceUpdateAction,
  type CostPriceUpdateInput,
  type CostPriceUpdatePreview,
  type CostPriceUpdatePreviewRow,
} from '@/app/actions/products';
import { AlertTriangle, FileSpreadsheet, Upload } from 'lucide-react';

interface CostPriceUpdateDialogProps {
  onUpdateSuccess: () => void;
  disabled?: boolean;
}

const normalizeHeader = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const parseMoney = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  if (!raw || /^\$?\s*-\s*$/.test(raw)) return null;
  const normalized = raw
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '')
    .replace(/-/g, '')
    .trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value?: number | null) => {
  if (value === undefined || value === null) return '--';
  return `$${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
};

const statusVariant = (status: CostPriceUpdatePreviewRow['status']) => {
  if (status === 'valid') return 'default';
  if (status === 'no-change') return 'secondary';
  return 'destructive';
};

export function CostPriceUpdateDialog({ onUpdateSuccess, disabled }: CostPriceUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CostPriceUpdateInput[]>([]);
  const [preview, setPreview] = useState<CostPriceUpdatePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();
  const { toast } = useToast();

  const validRows = useMemo(() => preview?.rows.filter(row => row.status === 'valid') ?? [], [preview]);

  const parseWorkbook = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, raw: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');

    // Auto-detect header row: first row within the first 15 that contains a cell normalized to 'sku'
    let headerRowIndex = -1;
    const scanLimit = Math.min(range.e.r, range.s.r + 15);
    outer: for (let rowIdx = range.s.r; rowIdx <= scanLimit; rowIdx += 1) {
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c: col })];
        if (normalizeHeader(cell?.v ?? cell?.w) === 'sku') {
          headerRowIndex = rowIdx;
          break outer;
        }
      }
    }
    if (headerRowIndex === -1) {
      throw new Error('No se encontró la columna SKU en el archivo.');
    }

    const headerMap = new Map<string, number>();
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: headerRowIndex, c: col })];
      const key = normalizeHeader(cell?.v ?? cell?.w);
      if (key) headerMap.set(key, col);
    }

    const skuCol = headerMap.get('sku')!;

    const getCellValue = (rowIndex: number, headerKey: string) => {
      const col = headerMap.get(headerKey);
      if (col === undefined) return null;
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: col })];
      if (!cell || cell.t === 'e') return null; // skip error cells (#N/A, #VALUE!, etc.)
      return cell.v ?? cell.w ?? null;
    };

    // Detect year/month/date columns for liquidation rule
    const YEAR_KEYS = new Set(['ano', 'anio', 'year', 'anocompra', 'anodecompra', 'anopedido', 'anoadquirido', 'purchaseyear', 'yearofpurchase']);
    const DATE_KEYS = new Set(['fecha', 'fechacompra', 'fechadecompra', 'fechapedido', 'purchasedate', 'dateofpurchase']);
    let yearHeaderKey: string | undefined;
    let dateHeaderKey: string | undefined;
    for (const key of headerMap.keys()) {
      if (!yearHeaderKey && YEAR_KEYS.has(key)) yearHeaderKey = key;
      if (!dateHeaderKey && DATE_KEYS.has(key)) dateHeaderKey = key;
    }

    const getPurchaseYear = (rowIndex: number): number | null => {
      if (yearHeaderKey) {
        const val = getCellValue(rowIndex, yearHeaderKey);
        if (val !== null) {
          const y = typeof val === 'number' ? Math.trunc(val) : parseInt(String(val).trim(), 10);
          if (y >= 2000 && y <= 2100) return y;
        }
      }
      if (dateHeaderKey) {
        const val = getCellValue(rowIndex, dateHeaderKey);
        if (val !== null) {
          if (val instanceof Date) return val.getFullYear();
          if (typeof val === 'string') {
            const m = val.trim().match(/^(\d{4})/);
            if (m) { const y = parseInt(m[1], 10); if (y >= 2000 && y <= 2100) return y; }
          }
        }
      }
      return null;
    };

    const parsedRows: CostPriceUpdateInput[] = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex <= range.e.r; rowIndex += 1) {
      const skuCell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: skuCol })];
      const skuValue = skuCell?.v ?? skuCell?.w ?? '';
      const sku = typeof skuValue === 'number' ? String(Math.trunc(skuValue)) : String(skuValue).trim();
      if (!sku) continue;

      const cost = parseMoney(getCellValue(rowIndex, 'costo'));
      const purchaseYear = getPurchaseYear(rowIndex);
      const isLiquidation = purchaseYear !== null && purchaseYear <= 2023 && cost !== null && cost > 0;

      // Dropshipping price: try multiple column name variants
      const priceDropshippingFromFile =
        parseMoney(getCellValue(rowIndex, 'preciomaria')) ??
        parseMoney(getCellValue(rowIndex, 'preciodropshipping')) ??
        parseMoney(getCellValue(rowIndex, 'preciodrop')) ??
        parseMoney(getCellValue(rowIndex, 'drop')) ??
        parseMoney(getCellValue(rowIndex, 'dropshipping'));

      // Wholesale price: try multiple column name variants
      const priceWholesaleFromFile =
        parseMoney(getCellValue(rowIndex, 'preciomayor')) ??
        parseMoney(getCellValue(rowIndex, 'preciomayorista')) ??
        parseMoney(getCellValue(rowIndex, 'mayorista')) ??
        parseMoney(getCellValue(rowIndex, 'mayor')) ??
        parseMoney(getCellValue(rowIndex, 'wholesale'));

      parsedRows.push({
        rowNumber: rowIndex + 1,
        sku,
        cost,
        priceDropshipping: isLiquidation ? cost : priceDropshippingFromFile,
        priceWholesale: isLiquidation ? cost : (priceWholesaleFromFile ?? undefined),
        priceMinSale: parseMoney(getCellValue(rowIndex, 'preciominventa')),
        priceOptimalSale: parseMoney(getCellValue(rowIndex, 'preciooptimodeventa')),
        isLiquidation,
      });
    }

    return parsedRows;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreview(null);
    setRows([]);
    setError(null);
    if (!file) return;
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Selecciona un archivo Excel válido (.xlsx o .xls).');
      return;
    }

    setFileName(file.name);
    startTransition(async () => {
      try {
        const parsedRows = await parseWorkbook(file);
        if (parsedRows.length === 0) {
          setError('El archivo no contiene filas con SKU.');
          return;
        }
        setRows(parsedRows);
        const result = await previewCostPriceUpdateAction(parsedRows, user);
        setPreview(result);
        if (!result.success) setError(result.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo procesar el archivo.');
      }
    });
  };

  const handleApply = () => {
    if (!user || rows.length === 0) return;
    startTransition(async () => {
      const result = await applyCostPriceUpdateAction(rows, user);
      setPreview(result.preview);
      if (result.success) {
        toast({
          title: 'Actualización aplicada',
          description: `${result.applied} filas actualizadas. ${result.skipped} omitidas.`,
        });
        onUpdateSuccess();
      } else {
        setError(result.message);
      }
    });
  };

  const handleDownloadDuplicates = () => {
    if (!preview) return;
    const duplicateRows = preview.rows.filter(row => row.status === 'duplicate-system');
    const report: Record<string, string | number>[] = [];
    for (const row of duplicateRows) {
      (row.conflicts ?? []).forEach((conflict, i) => {
        report.push({
          SKU: row.sku,
          'Fila en archivo': row.rowNumber,
          [`Coincidencia ${i + 1} — Producto`]: conflict.productName,
          [`Coincidencia ${i + 1} — Variante`]: conflict.variantName ?? '',
          [`Coincidencia ${i + 1} — Tipo`]: conflict.targetType === 'variant' ? 'Variante' : 'Producto simple',
          [`Coincidencia ${i + 1} — ID Producto`]: conflict.productId,
        });
      });
    }
    const worksheet = XLSX.utils.json_to_sheet(report);
    worksheet['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 40 }, { wch: 25 }, { wch: 18 }, { wch: 30 }, { wch: 40 }, { wch: 25 }, { wch: 18 }, { wch: 30 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SKU Duplicados');
    XLSX.writeFile(workbook, `sku-duplicados-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDownloadReport = () => {
    if (!preview) return;
    const report = preview.rows.map(row => ({
      Fila: row.rowNumber,
      SKU: row.sku,
      Estado: row.status,
      Liquidación: row.isLiquidation ? 'Sí' : 'No',
      Mensaje: row.message,
      Producto: row.productName || '',
      Variante: row.variantName || '',
      'Costo actual': row.currentCost ?? '',
      'Costo nuevo': row.cost ?? '',
      'Precio Drop actual': row.currentPriceDropshipping ?? '',
      'Precio Drop nuevo': row.priceDropshipping ?? '',
      'Precio Mayor actual': row.currentPriceWholesale ?? '',
      'Precio Mayor nuevo': row.priceWholesale ?? '',
      'Precio min actual': row.currentPriceMinSale ?? '',
      'Precio min nuevo': row.priceMinSale ?? '',
      'Precio opt actual': row.currentPriceOptimalSale ?? '',
      'Precio opt nuevo': row.priceOptimalSale ?? '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(report);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
    XLSX.writeFile(workbook, `reporte-costos-precios-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(event) => event.preventDefault()} disabled={disabled}>
          <Upload className="mr-2 h-4 w-4" />
          Actualizar costos y precios
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Actualizar costos y precios</DialogTitle>
          <DialogDescription>
            Carga el Excel de costos. Se actualizarán solo productos existentes por SKU; no se modifica el stock.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={isPending} />
          {fileName && <p className="text-sm text-muted-foreground">{fileName}</p>}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <div className="grid grid-cols-2 md:grid-cols-8 gap-2 text-sm">
              <Badge>Total: {preview.summary.total}</Badge>
              <Badge>Aplicables: {preview.summary.valid}</Badge>
              <Badge variant="secondary">Sin cambios: {preview.summary.noChange}</Badge>
              <Badge variant="destructive">No encontrados: {preview.summary.notFound}</Badge>
              <Badge variant="destructive">Duplicados archivo: {preview.summary.duplicateFile}</Badge>
              <Badge variant="destructive">Duplicados sistema: {preview.summary.duplicateSystem}</Badge>
              <Badge variant="destructive">Inválidos: {preview.summary.invalid}</Badge>
              {preview.rows.some(r => r.isLiquidation) && (
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  Liq.: {preview.rows.filter(r => r.isLiquidation).length}
                </Badge>
              )}
            </div>
          )}

          {preview && (
            <ScrollArea className="h-[420px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fila</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Precio Drop</TableHead>
                    <TableHead>X Mayor</TableHead>
                    <TableHead>Min/Óptimo</TableHead>
                    <TableHead>Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 300).map((row) => (
                    <TableRow key={`${row.rowNumber}-${row.sku}`} className={row.isLiquidation ? 'bg-blue-50 dark:bg-blue-950/20' : undefined}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                          {row.isLiquidation && <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px]">liq.</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                      <TableCell>
                        <div className="font-medium">{row.productName || '--'}</div>
                        {row.variantName && <div className="text-xs text-muted-foreground">{row.variantName}</div>}
                      </TableCell>
                      <TableCell>{formatCurrency(row.currentCost)} {'->'} {formatCurrency(row.cost)}</TableCell>
                      <TableCell>{formatCurrency(row.currentPriceDropshipping)} {'->'} {formatCurrency(row.priceDropshipping)}</TableCell>
                      <TableCell>{formatCurrency(row.currentPriceWholesale)} {'->'} {formatCurrency(row.priceWholesale)}</TableCell>
                      <TableCell>{formatCurrency(row.priceMinSale)} / {formatCurrency(row.priceOptimalSale)}</TableCell>
                      <TableCell className="text-xs">{row.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.rows.length > 300 && (
                <p className="p-3 text-xs text-muted-foreground">
                  Mostrando las primeras 300 filas. Descarga el reporte para ver el detalle completo.
                </p>
              )}
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {preview && preview.summary.duplicateSystem > 0 && (
            <Button variant="outline" onClick={handleDownloadDuplicates} className="text-amber-600 border-amber-300 hover:bg-amber-50">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Descargar {preview.summary.duplicateSystem} SKU duplicados
            </Button>
          )}
          <Button variant="outline" onClick={handleDownloadReport} disabled={!preview}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Descargar reporte
          </Button>
          <Button onClick={handleApply} disabled={isPending || validRows.length === 0}>
            {isPending ? 'Procesando...' : `Aplicar ${validRows.length} cambios`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
