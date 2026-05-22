"use client";

import { useMemo, useState, useTransition } from 'react';
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
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';
import { applyWholesalePriceUpdateAction } from '@/app/actions/products';
import { Calculator } from 'lucide-react';

interface WholesalePricingDialogProps {
  products: Product[];
  onUpdateSuccess: () => void;
  disabled?: boolean;
}

type Suggestion = {
  sku: string;
  name: string;
  rotation: string;
  cost: number;
  currentWholesale?: number | null;
  suggestedWholesale: number;
  margin: number;
};

const formatCurrency = (value?: number | null) => {
  if (value === undefined || value === null) return '--';
  return `$${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
};

const roundToHundred = (value: number) => Math.ceil(value / 100) * 100;

export function WholesalePricingDialog({ products, onUpdateSuccess, disabled }: WholesalePricingDialogProps) {
  const [open, setOpen] = useState(false);
  const [healthyMargin, setHealthyMargin] = useState(25);
  const [lowMargin, setLowMargin] = useState(15);
  const [liquidationMargin, setLiquidationMargin] = useState(8);
  const [quantity, setQuantity] = useState(12);
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();
  const { toast } = useToast();

  const quantityAdjustment = quantity >= 24 ? 5 : quantity >= 12 ? 3 : 0;

  const suggestions = useMemo<Suggestion[]>(() => {
    const rows: Suggestion[] = [];

    const marginForRotation = (rotation?: string) => {
      if (rotation === 'Escalado' || rotation === 'Alta rotación' || rotation === 'Activo') return healthyMargin;
      if (rotation === 'Baja rotación') return lowMargin;
      return liquidationMargin;
    };

    const pushSuggestion = (
      sku: string | undefined,
      name: string,
      rotation: string | undefined,
      cost: number | undefined,
      currentWholesale: number | undefined | null
    ) => {
      if (!sku || !cost || cost <= 0) return;
      const baseMargin = marginForRotation(rotation);
      const finalMargin = Math.max(5, baseMargin - quantityAdjustment);
      const suggestedWholesale = roundToHundred(cost / (1 - finalMargin / 100));
      rows.push({
        sku,
        name,
        rotation: rotation || 'Inactivo',
        cost,
        currentWholesale,
        suggestedWholesale,
        margin: finalMargin,
      });
    };

    products.forEach(product => {
      if (product.productType === 'variable' && product.variants?.length) {
        product.variants.forEach(variant => {
          pushSuggestion(
            variant.sku,
            `${product.name} - ${variant.name}`,
            product.rotationCategoryName,
            variant.cost,
            variant.priceWholesale
          );
        });
      } else {
        pushSuggestion(product.sku, product.name, product.rotationCategoryName, product.cost, product.priceWholesale);
      }
    });

    return rows;
  }, [products, healthyMargin, lowMargin, liquidationMargin, quantityAdjustment]);

  const changedSuggestions = suggestions.filter(row => row.currentWholesale !== row.suggestedWholesale);

  const handleApply = () => {
    if (!user) return;
    startTransition(async () => {
      const result = await applyWholesalePriceUpdateAction(
        changedSuggestions.map(row => ({ sku: row.sku, priceWholesale: row.suggestedWholesale })),
        user
      );
      if (result.success) {
        toast({ title: 'Precios mayoristas actualizados', description: result.message });
        onUpdateSuccess();
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(event) => event.preventDefault()} disabled={disabled}>
          <Calculator className="mr-2 h-4 w-4" />
          Calcular precio x mayor
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Reglas de precio x mayor</DialogTitle>
          <DialogDescription>
            Calcula sugerencias desde costo, rotación y cantidad. Aplicar cambios requiere confirmación explícita.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Margen alta/activa (%)</Label>
            <Input type="number" value={healthyMargin} onChange={(e) => setHealthyMargin(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Margen baja (%)</Label>
            <Input type="number" value={lowMargin} onChange={(e) => setLowMargin(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Margen inactiva/liquidación (%)</Label>
            <Input type="number" value={liquidationMargin} onChange={(e) => setLiquidationMargin(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Cantidad de referencia</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
          </div>
        </div>

        <ScrollArea className="h-[420px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Rotación</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Sugerido</TableHead>
                <TableHead>Margen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.slice(0, 250).map(row => (
                <TableRow key={row.sku}>
                  <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.rotation}</TableCell>
                  <TableCell>{formatCurrency(row.cost)}</TableCell>
                  <TableCell>{formatCurrency(row.currentWholesale)}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(row.suggestedWholesale)}</TableCell>
                  <TableCell>{row.margin}%</TableCell>
                </TableRow>
              ))}
              {suggestions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No hay productos visibles con costo para calcular.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleApply} disabled={isPending || changedSuggestions.length === 0}>
            {isPending ? 'Aplicando...' : `Aplicar ${changedSuggestions.length} sugerencias visibles`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
