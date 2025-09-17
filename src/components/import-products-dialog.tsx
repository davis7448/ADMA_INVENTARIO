
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

interface ImportProductsDialogProps {
  onImportSuccess: () => void;
}

type ProductToImport = {
    [key: string]: any;
};

const REQUIRED_HEADERS = [
    'name', 'sku', 'description',
    'categoryId', 'priceDropshipping', 'stock', 'vendorId', 'productType'
];

// Helper to sanitize headers
const sanitizeHeaders = (products: ProductToImport[]): ProductToImport[] => {
    return products.map(product => {
        const sanitizedProduct: ProductToImport = {};
        for (const key in product) {
            let newKey = key.trim();
            if (newKey.toLowerCase() === 'categoryld') {
                newKey = 'categoryId';
            } else if (newKey.toLowerCase() === 'vendorld') {
                newKey = 'vendorId';
            }
            sanitizedProduct[newKey] = product[key];
        }
        return sanitizedProduct;
    });
};


export function ImportProductsDialog({ onImportSuccess }: ImportProductsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [products, setProducts] = useState<ProductToImport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

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
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as ProductToImport[];

            if (json.length > 0) {
                const sanitizedJson = sanitizeHeaders(json);
                const headers = Object.keys(sanitizedJson[0]);
                const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
                if (missingHeaders.length > 0) {
                    setError(`Faltan las siguientes columnas obligatorias en el archivo: ${missingHeaders.join(', ')}. Revisa que los nombres sean correctos.`);
                    setProducts([]);
                    return;
                }
                setProducts(sanitizedJson);
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
        const plainProducts = JSON.parse(JSON.stringify(products));
        const result = await importProductsAction(plainProducts);
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
                description: result.message,
            });
        }
    });
  };
  
  const handleDownloadTemplate = () => {
    const data = [REQUIRED_HEADERS.reduce((acc, h) => ({ ...acc, [h]: ''}), {})];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
    XLSX.writeFile(workbook, "plantilla_productos.xlsx");
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
          <DialogTitle>Importar Productos Masivamente</DialogTitle>
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
                                {Object.values(product).map((value, i) => <TableCell key={i}>{String(value)}</TableCell>)}
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
