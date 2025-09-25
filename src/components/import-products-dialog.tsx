

"use client";

import { useState, useTransition } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { importProductsAction } from '@/app/actions/products';
import { Upload, FileDown, FileSpreadsheet } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
import { DropdownMenuItem } from './ui/dropdown-menu';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface ImportProductsDialogProps {
  onImportSuccess: () => void;
}

type ProductToImport = {
    [key: string]: any;
};

// Helper to sanitize headers to fix common typos and casing
const sanitizeHeaders = (products: ProductToImport[]): ProductToImport[] => {
    return products.map(product => {
        const sanitizedProduct: ProductToImport = {};
        for (const key in product) {
            let newKey = key.trim().toLowerCase().replace(/\s+/g, '');
            sanitizedProduct[newKey] = product[key];
        }
        return sanitizedProduct;
    });
};

const DEFAULT_WAREHOUSE_ID = 'wh-bog';

export function ImportProductsDialog({ onImportSuccess }: ImportProductsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [products, setProducts] = useState<ProductToImport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, warehouses } = useAuth();
  const [selectedWarehouse, setSelectedWarehouse] = useState(DEFAULT_WAREHOUSE_ID);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
        parseFile(selectedFile);
    }
  };

  const parseFile = (fileToParse: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { 
                defval: null
            }) as ProductToImport[];

            if (json.length > 0) {
                // Sanitize headers first (convert to lowercase)
                let processedJson = sanitizeHeaders(json);

                // Clean up data: trim strings, parse numbers, handle dates
                processedJson = processedJson.map(row => {
                    const newRow = { ...row };
                    for (const key in newRow) {
                        if (typeof newRow[key] === 'string') {
                            newRow[key] = newRow[key].trim();
                        }
                    }
                    // Explicitly parse numeric fields
                    const numericFields = ['pricedropshipping', 'pricewholesale', 'cost', 'stock'];
                    numericFields.forEach(field => {
                        if (newRow[field] !== null && newRow[field] !== undefined) {
                            const parsed = parseFloat(newRow[field]);
                            if (!isNaN(parsed)) {
                                newRow[field] = parsed;
                            }
                        }
                    });
                    
                    return newRow;
                });
                
                const headers = Object.keys(processedJson[0]);
                const requiredHeaders = ['name', 'sku', 'description', 'pricedropshipping', 'stock', 'categoryid', 'vendorid'];
                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
                
                if (missingHeaders.length > 0) {
                    setError(`Faltan las siguientes columnas obligatorias: ${missingHeaders.join(', ')}. Por favor, usa la plantilla.`);
                    setProducts([]);
                    return;
                }

                setProducts(processedJson);
            } else {
                 setProducts([]);
            }
            
            setError(null);
        } catch (err) {
            console.error(err);
            setError("Hubo un error al procesar el archivo. Asegúrate de que es un formato Excel válido.");
            setProducts([]);
        }
    };
    reader.onerror = () => {
        setError("No se pudo leer el archivo.");
        setProducts([]);
    }
    reader.readAsArrayBuffer(fileToParse);
  }

  const handleImport = () => {
    if (products.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No hay productos para importar',
        description: 'Por favor, sube un archivo con productos válidos.',
      });
      return;
    }

    startTransition(async () => {
        const result = await importProductsAction(products, user, selectedWarehouse);
        if (result.success) {
            toast({
                title: '¡Importación Exitosa!',
                description: `${result.count} productos han sido importados correctamente.`,
            });
            onImportSuccess();
            setOpen(false);
            setFile(null);
            setProducts([]);
        } else {
            toast({
                variant: 'destructive',
                title: 'Error en la Importación',
                description: result.errors || result.message,
                duration: 10000,
            });
        }
    });
  };
  
  const handleDownloadTemplate = () => {
    const templateHeaders = [
        'name', 'sku', 'description',
        'pricedropshipping', 'pricewholesale', 'cost', 'stock',
        'categoryid', 'vendorid', 'warehouseid',
        'purchasedate'
    ];
    const data = [templateHeaders.reduce((acc, h) => {
        if (h === 'warehouseid') {
            return { ...acc, [h]: selectedWarehouse };
        }
        return { ...acc, [h]: '' };
    }, {})];
    const worksheet = XLSX.utils.json_to_sheet(data);

    if(worksheet['K1']) {
        worksheet['K2'] = { t: 'd', v: new Date() };
        worksheet['!cols'] = worksheet['!cols'] || [];
        worksheet['!cols'][10] = { wch: 12 };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
    XLSX.writeFile(workbook, "plantilla_productos_simples.xlsx");
  }

  const formatCell = (value: any) => {
    if (value instanceof Date) {
        return format(value, 'dd/MM/yyyy');
    }
    return String(value);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Upload className="mr-2 h-4 w-4" />
            Importar desde Excel
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Productos Masivamente (Solo Simples)</DialogTitle>
          <DialogDescription>
            Sube un archivo Excel (.xlsx) con la lista de productos. Asegúrate de que las columnas coincidan con la plantilla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <label htmlFor="file-upload" className="flex-1 w-full">
                    <div className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                        <div className="text-center">
                            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">
                                <span className="font-semibold">
                                    {file ? file.name : 'Haz clic o arrastra un archivo aquí'}
                                </span>
                            </p>
                        </div>
                    </div>
                    <input id="file-upload" type="file" className="hidden" accept=".xlsx" onChange={handleFileChange} />
                </label>
                <Button variant="outline" onClick={handleDownloadTemplate}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Descargar Plantilla
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <Label htmlFor="warehouse-select">Bodega Destino</Label>
                <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Seleccionar Bodega" />
                    </SelectTrigger>
                    <SelectContent>
                        {warehouses.map(warehouse => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>

        {products.length > 0 && (
            <div className="flex-1 overflow-auto border rounded-lg">
                <h3 className="p-4 font-semibold">Previsualización de Datos ({products.length} productos)</h3>
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                            {Object.keys(products[0]).map(header => <TableHead key={header}>{header}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.slice(0, 10).map((product, index) => (
                            <TableRow key={index}>
                                {Object.keys(product).map((key) => <TableCell key={key}>{formatCell(product[key])}</TableCell>)}
                            </TableRow>
                        ))}
                         {products.length > 10 && (
                            <TableRow>
                                <TableCell colSpan={Object.keys(products[0]).length} className="text-center text-muted-foreground">
                                    ... y {products.length - 10} más.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleImport} disabled={isPending || products.length === 0 || !!error}>
            {isPending ? 'Importando...' : `Importar ${products.length} Productos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
      

    

    

  
