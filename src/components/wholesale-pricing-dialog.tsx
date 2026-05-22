"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
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
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
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

  const changedSuggestions = useMemo(
    () => suggestions.filter(row => row.currentWholesale !== row.suggestedWholesale),
    [suggestions]
  );

  // Auto-select all changed items whenever margin parameters change
  useEffect(() => {
    setSelectedSkus(new Set(changedSuggestions.map(r => r.sku)));
  }, [healthyMargin, lowMargin, liquidationMargin, quantity]);

  const selectedChanged = changedSuggestions.filter(r => selectedSkus.has(r.sku));
  const allChangedSelected = changedSuggestions.length > 0 && changedSuggestions.every(r => selectedSkus.has(r.sku));
  const someChangedSelected = changedSuggestions.some(r => selectedSkus.has(r.sku));

  const toggleSku = (sku: string) => {
    setSelectedSkus(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  const toggleAll = () => {
    if (allChangedSelected) {
      setSelectedSkus(new Set());
    } else {
      setSelectedSkus(new Set(changedSuggestions.map(r => r.sku)));
    }
  };

  const handleApply = () => {
    if (!user || selectedChanged.length === 0) return;
    startTransition(async () => {
      const result = await applyWholesalePriceUpdateAction(
        selectedChanged.map(row => ({ sku: row.sku, priceWholesale: row.suggestedWholesale })),
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
            Calcula sugerencias desde costo, rotación y cantidad. Selecciona los productos a actualizar y confirma.
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
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChangedSelected}
                    data-state={someChangedSelected && !allChangedSelected ? 'indeterminate' : undefined}
                    onCheckedChange={toggleAll}
                    disabled={changedSuggestions.length === 0}
                    aria-label="Seleccionar todos con cambios"
                  />
                </TableHead>
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
              {suggestions.slice(0, 250).map(row => {
                const hasChange = row.currentWholesale !== row.suggestedWholesale;
                const isSelected = selectedSkus.has(row.sku);
                return (
                  <TableRow
                    key={row.sku}
                    className={isSelected && hasChange ? 'bg-amber-50 dark:bg-amber-950/20' : undefined}
                    onClick={() => hasChange && toggleSku(row.sku)}
                    style={{ cursor: hasChange ? 'pointer' : 'default' }}
                  >
                    <TableCell>
                      {hasChange && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSku(row.sku)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Seleccionar ${row.name}`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.rotation}</TableCell>
                    <TableCell>{formatCurrency(row.cost)}</TableCell>
                    <TableCell className={hasChange ? 'text-muted-foreground line-through' : undefined}>
                      {formatCurrency(row.currentWholesale)}
                    </TableCell>
                    <TableCell className={hasChange ? 'font-semibold text-amber-700 dark:text-amber-400' : 'font-semibold text-muted-foreground'}>
                      {formatCurrency(row.suggestedWholesale)}
                    </TableCell>
                    <TableCell>{row.margin}%</TableCell>
                  </TableRow>
                );
              })}
              {suggestions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No hay productos visibles con costo para calcular.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter className="items-center gap-2">
          <p className="text-sm text-muted-foreground mr-auto">
            {selectedChanged.length} de {changedSuggestions.length} con cambios seleccionados
          </p>
          <Button onClick={handleApply} disabled={isPending || selectedChanged.length === 0}>
            {isPending ? 'Aplicando...' : `Aplicar ${selectedChanged.length} seleccionados`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
