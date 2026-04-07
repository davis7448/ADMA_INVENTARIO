"use client";

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Warehouse, Product } from '@/lib/types';
import {
  uploadExternalStockAction,
  saveNewMappingsAction,
  type ParsedExternalRow,
  type NewMappingInput,
} from '@/app/actions/external-warehouses';
import { Upload, Check, AlertTriangle, Search, X } from 'lucide-react';
import { getProducts } from '@/lib/api';

interface Props {
  warehouse: Warehouse;
  open: boolean;
  uploadedBy: { id: string; name: string };
  onClose: (snapshotId?: string) => void;
}

type MappingChoice = 'skip' | string; // string = internalProductId

interface UnmappedRowState {
  row: ParsedExternalRow;
  choice: MappingChoice | null;
  selectedProduct: Product | null;
}

type Step = 'upload' | 'mapping' | 'confirm';

export function ExternalStockUploadDialog({ warehouse, open, uploadedBy, onClose }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedExternalRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // After upload action
  const [snapshotId, setSnapshotId] = useState('');
  const [mappedRows, setMappedRows] = useState<(ParsedExternalRow & { internalSku: string; mappingId: string; internalProductId: string })[]>([]);
  const [unmappedStates, setUnmappedStates] = useState<UnmappedRowState[]>([]);

  // Product search
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  const reset = () => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setParseError('');
    setSnapshotId('');
    setMappedRows([]);
    setUnmappedStates([]);
    setAllProducts([]);
    setSearchTerms({});
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setFileName(file.name);

    const { columnConfig } = warehouse;
    if (!columnConfig) {
      setParseError('Esta bodega no tiene columnas configuradas. Configúralas primero desde Ajustes → Bodegas.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        // Sanitize to plain primitives — XLSX can return non-serializable objects
        const sanitize = (raw: Record<string, unknown>): Record<string, string | number | boolean | null> => {
          const out: Record<string, string | number | boolean | null> = {};
          for (const [k, v] of Object.entries(raw)) {
            if (v === null || v === undefined) out[k] = null;
            else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
            else out[k] = String(v);
          }
          return out;
        };

        const rows: ParsedExternalRow[] = [];
        for (const raw of jsonRows) {
          const externalIdentifier = raw[columnConfig.identifierColumn];
          const externalName = raw[columnConfig.nameColumn];
          const stockRaw = raw[columnConfig.stockColumn];

          if (externalIdentifier == null || externalName == null) continue;

          rows.push({
            externalIdentifier: String(externalIdentifier).trim(),
            externalName: String(externalName).trim(),
            stockQuantity: Number(stockRaw) || 0,
            rawData: sanitize(raw),
          });
        }

        if (rows.length === 0) {
          setParseError('No se encontraron filas válidas en el archivo. Verifica la configuración de columnas.');
          return;
        }
        setParsedRows(rows);
      } catch {
        setParseError('Error al leer el archivo. Asegúrate de que sea un Excel válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleUpload = async () => {
    if (!parsedRows.length) return;
    setIsSaving(true);
    const result = await uploadExternalStockAction(warehouse.id, parsedRows, fileName, uploadedBy);
    setIsSaving(false);

    if (!result.success) {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
      return;
    }

    setSnapshotId(result.snapshotId!);
    setMappedRows(result.mapped);

    if (result.unmapped.length === 0) {
      setStep('confirm');
      return;
    }

    // Load products for the mapping step
    const { products } = await getProducts({ fetchAll: true });
    setAllProducts(products);
    setUnmappedStates(result.unmapped.map(r => ({ row: r, choice: null, selectedProduct: null })));
    setStep('mapping');
  };

  const filteredProducts = useCallback((identifier: string): Product[] => {
    const term = (searchTerms[identifier] ?? '').toLowerCase();
    if (!term) return allProducts.slice(0, 30);
    return allProducts.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.sku ?? '').toLowerCase().includes(term)
    ).slice(0, 30);
  }, [allProducts, searchTerms]);

  const handleSelectProduct = (identifier: string, product: Product) => {
    setUnmappedStates(prev => prev.map(s =>
      s.row.externalIdentifier === identifier
        ? { ...s, choice: product.id, selectedProduct: product }
        : s
    ));
  };

  const handleSkip = (identifier: string) => {
    setUnmappedStates(prev => prev.map(s =>
      s.row.externalIdentifier === identifier
        ? { ...s, choice: 'skip', selectedProduct: null }
        : s
    ));
  };

  const handleClearChoice = (identifier: string) => {
    setUnmappedStates(prev => prev.map(s =>
      s.row.externalIdentifier === identifier
        ? { ...s, choice: null, selectedProduct: null }
        : s
    ));
  };

  const pendingCount = unmappedStates.filter(s => s.choice === null).length;

  const handleSaveMappings = async () => {
    const toMap: NewMappingInput[] = unmappedStates
      .filter(s => s.choice !== null && s.choice !== 'skip' && s.selectedProduct)
      .map(s => ({
        externalIdentifier: s.row.externalIdentifier,
        externalName: s.row.externalName,
        internalProductId: s.selectedProduct!.id,
        internalSku: s.selectedProduct!.sku ?? s.selectedProduct!.variants?.[0]?.sku ?? '',
        internalProductName: s.selectedProduct!.name,
      }));

    if (toMap.length > 0) {
      setIsSaving(true);
      const result = await saveNewMappingsAction(warehouse.id, snapshotId, toMap);
      setIsSaving(false);
      if (!result.success) {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
        return;
      }
    }
    setStep('confirm');
  };

  const mappedNewCount = unmappedStates.filter(s => s.choice !== null && s.choice !== 'skip').length;
  const skippedCount = unmappedStates.filter(s => s.choice === 'skip').length;
  const totalMapped = mappedRows.length + mappedNewCount;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Cargar inventario — {warehouse.name}</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Sube el archivo Excel de inventario externo.'}
            {step === 'mapping' && `${unmappedStates.length} producto(s) sin mapeo. Asigna cada uno a un producto interno o márcalo como omitido.`}
            {step === 'confirm' && 'Resumen de la carga.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4 py-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {fileName || 'Haz clic para seleccionar el archivo Excel'}
                  </span>
                </div>
              </Button>

              {parseError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> {parseError}
                </p>
              )}

              {parsedRows.length > 0 && (
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <p className="font-medium">Vista previa</p>
                  <p className="text-muted-foreground">{parsedRows.length} productos encontrados en el archivo.</p>
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {parsedRows.slice(0, 10).map(r => (
                      <div key={r.externalIdentifier} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1">
                        <span className="font-mono">{r.externalIdentifier}</span>
                        <span className="truncate mx-2 text-muted-foreground">{r.externalName}</span>
                        <span className="font-medium">{r.stockQuantity} u.</span>
                      </div>
                    ))}
                    {parsedRows.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">... y {parsedRows.length - 10} más</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-3 py-2">
              <div className="text-sm text-muted-foreground">
                {pendingCount > 0
                  ? `${pendingCount} pendiente(s) de asignar.`
                  : 'Todos asignados. Puedes confirmar.'}
              </div>
              {unmappedStates.map(({ row, choice, selectedProduct }) => (
                <div key={row.externalIdentifier} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{row.externalIdentifier}</span>
                      <p className="font-medium">{row.externalName}</p>
                      <span className="text-xs text-muted-foreground">Stock: {row.stockQuantity} u.</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {choice !== null && (
                        <button onClick={() => handleClearChoice(row.externalIdentifier)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      {choice === 'skip' && <Badge variant="secondary">Omitido</Badge>}
                      {choice !== null && choice !== 'skip' && selectedProduct && (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <Check className="h-3 w-3 mr-1" />
                          {selectedProduct.sku || selectedProduct.name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {choice === null && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nombre o SKU..."
                          className="pl-8 text-sm"
                          value={searchTerms[row.externalIdentifier] ?? ''}
                          onChange={(e) => setSearchTerms(prev => ({ ...prev, [row.externalIdentifier]: e.target.value }))}
                        />
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-1">
                        {filteredProducts(row.externalIdentifier).map(p => (
                          <button
                            key={p.id}
                            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center justify-between gap-2"
                            onClick={() => handleSelectProduct(row.externalIdentifier, p)}
                          >
                            <span className="truncate">{p.name}</span>
                            <span className="font-mono shrink-0 text-muted-foreground">{p.sku || p.variants?.[0]?.sku || '—'}</span>
                          </button>
                        ))}
                        {filteredProducts(row.externalIdentifier).length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">Sin resultados</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground"
                        onClick={() => handleSkip(row.externalIdentifier)}
                      >
                        Omitir este producto
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* STEP 3: Confirm */}
          {step === 'confirm' && (
            <div className="py-4 space-y-4">
              <div className="rounded-md border divide-y">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">Total productos</span>
                  <span className="font-semibold">{parsedRows.length}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">Mapeados (auto + manual)</span>
                  <span className="font-semibold text-green-700">{totalMapped}</span>
                </div>
                {skippedCount > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">Omitidos</span>
                    <span className="font-semibold text-muted-foreground">{skippedCount}</span>
                  </div>
                )}
                {parsedRows.length - totalMapped - skippedCount > 0 && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">Sin mapeo (pendientes)</span>
                    <span className="font-semibold text-amber-600">{parsedRows.length - totalMapped - skippedCount}</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                La carga fue guardada. Puedes ver el historial y la rotación en la página de Bodegas Externas.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {step === 'upload' && (
            <>
              <Button variant="secondary" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={parsedRows.length === 0 || isSaving || !!parseError}>
                {isSaving ? 'Procesando...' : 'Continuar'}
              </Button>
            </>
          )}
          {step === 'mapping' && (
            <>
              <Button variant="secondary" onClick={() => setStep('upload')}>Atrás</Button>
              <Button onClick={handleSaveMappings} disabled={isSaving || pendingCount > 0}>
                {isSaving ? 'Guardando...' : `Confirmar (${pendingCount > 0 ? `${pendingCount} pendiente(s)` : 'listo'})`}
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <Button onClick={() => { const id = snapshotId; reset(); onClose(id); }}>
              Ver rotación
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
