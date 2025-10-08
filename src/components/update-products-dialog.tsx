"use client";

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { updateProductsAction } from '@/app/actions/products';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface UpdateProductsDialogProps {
  onUpdateSuccess: () => void;
  disabled?: boolean;
}

export function UpdateProductsDialog({ onUpdateSuccess, disabled }: UpdateProductsDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        setError('Por favor, selecciona un archivo Excel (.xlsx o .xls).');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = () => {
    if (!file || !user) return;

    startTransition(async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          setError('El archivo debe contener al menos una fila de encabezados y una fila de datos.');
          return;
        }

        const headers = jsonData[0] as string[];
        const requiredHeaders = ['sku'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

        if (missingHeaders.length > 0) {
          setError(`Faltan las siguientes columnas obligatorias: ${missingHeaders.join(', ')}`);
          return;
        }

        const products = jsonData.slice(1).map((row: any) => {
          const product: any = {};
          headers.forEach((header, index) => {
            product[header.toLowerCase().replace(/\s+/g, '')] = row[index];
          });
          return product;
        });

        const result = await updateProductsAction(products, user);

        if (result.success) {
          toast({
            title: '¡Éxito!',
            description: `Se actualizaron ${result.count} productos exitosamente.`,
          });
          setOpen(false);
          setFile(null);
          setError(null);
          onUpdateSuccess();
        } else {
          setError(result.errors || result.message);
        }
      } catch (err) {
        console.error('Error processing file:', err);
        setError('Ocurrió un error al procesar el archivo. Verifica que el formato sea correcto.');
      }
    });
  };

  const handleDownloadTemplate = () => {
    const XLSX = require('xlsx');
    const templateData = [
      {
        sku: 'SKU123',
        name: 'Nombre del Producto (opcional)',
        description: 'Descripción (opcional)',
        pricedropshipping: 10000,
        pricewholesale: 8000,
        cost: 5000,
        stock: 50,
        categoryid: 'category-id',
        vendorid: 'vendor-id',
        warehouseid: 'wh-bog',
        purchasedate: '2024-01-01',
        codigoerp: 'ERP-001',
      },
      {
        sku: 'VARIANT-SKU456',
        variantname: 'Nombre de la Variante (opcional)',
        variantpricedropshipping: 12000,
        variantpricewholesale: 9000,
        variantstock: 25,
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Actualizar_Productos");
    XLSX.writeFile(workbook, 'plantilla_actualizar_productos.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={disabled}>
          <Upload className="mr-2 h-4 w-4" />
          Actualizar desde Excel
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Actualizar Productos y Variantes Masivamente</DialogTitle>
          <DialogDescription>
            Sube un archivo Excel con los productos o variantes a actualizar. Solo se requiere la columna 'sku' para identificar el producto o variante.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="file-upload" className="text-right">
              Archivo
            </Label>
            <div className="col-span-3">
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isPending}
              />
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="text-sm text-muted-foreground">
            <p>Descarga la plantilla para ver el formato requerido:</p>
            <Button
              variant="link"
              className="p-0 h-auto font-normal"
              onClick={handleDownloadTemplate}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Descargar Plantilla
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!file || isPending}
          >
            {isPending ? 'Actualizando...' : 'Actualizar Productos'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}