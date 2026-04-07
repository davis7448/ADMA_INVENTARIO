"use client";

import { useState, useRef } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Warehouse, ExternalColumnConfig } from '@/lib/types';
import { updateColumnConfigAction } from '@/app/actions/external-warehouses';
import { Upload } from 'lucide-react';

interface Props {
  warehouse: Warehouse;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ExternalWarehouseColumnConfigDialog({ warehouse, open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [config, setConfig] = useState<Partial<ExternalColumnConfig>>(
    warehouse.columnConfig ?? {}
  );
  const [isSaving, setIsSaving] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      if (rows.length > 0) {
        const rawHeaders = rows[0] as unknown as (string | number | null)[];
        const cleaned = rawHeaders
          .map(h => (h != null ? String(h).trim() : ''))
          .filter(h => h.length > 0);
        setHeaders(cleaned);
        // Pre-select if config already set
        if (warehouse.columnConfig) {
          setConfig(warehouse.columnConfig);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => {
    if (!config.identifierColumn || !config.nameColumn || !config.stockColumn) {
      toast({ title: 'Error', description: 'Debes seleccionar las tres columnas.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const result = await updateColumnConfigAction(warehouse.id, config as ExternalColumnConfig);
    setIsSaving(false);
    if (result.success) {
      toast({ title: '¡Éxito!', description: result.message });
      onSaved ? onSaved() : onClose();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar columnas — {warehouse.name}</DialogTitle>
          <DialogDescription>
            Sube un archivo Excel de ejemplo para detectar las columnas disponibles y asignarlas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload */}
          <div>
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
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {fileName ?? 'Subir Excel de ejemplo'}
            </Button>
            {warehouse.columnConfig && headers.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Ya configurado: ID=<span className="font-mono">{warehouse.columnConfig.identifierColumn}</span>,
                Nombre=<span className="font-mono">{warehouse.columnConfig.nameColumn}</span>,
                Stock=<span className="font-mono">{warehouse.columnConfig.stockColumn}</span>
              </p>
            )}
          </div>

          {headers.length > 0 && (
            <>
              <div className="space-y-1">
                <Label>Columna de identificador externo</Label>
                <Select
                  value={config.identifierColumn ?? ''}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, identifierColumn: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Columna de nombre del producto</Label>
                <Select
                  value={config.nameColumn ?? ''}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, nameColumn: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Columna de stock actual</Label>
                <Select
                  value={config.stockColumn ?? ''}
                  onValueChange={(v) => setConfig(prev => ({ ...prev, stockColumn: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar columna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving || headers.length === 0}>
            {isSaving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
