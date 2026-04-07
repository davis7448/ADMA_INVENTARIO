"use client";

import { useEffect, useState } from 'react';
import type { ExternalRotationItem } from '@/lib/types';
import { getRotationDataAction } from '@/app/actions/external-warehouses';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

interface Props {
  warehouseId: string;
  snapshotId: string;
}

export function RotationSummary({ warehouseId, snapshotId }: Props) {
  const [items, setItems] = useState<ExternalRotationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getRotationDataAction(warehouseId, snapshotId).then(res => {
      if (res.success) {
        const sorted = [...res.data].sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
        setItems(sorted);
      } else {
        setError(res.message ?? 'Error al cargar rotación.');
      }
      setLoading(false);
    });
  }, [warehouseId, snapshotId]);

  const totalOut = items.filter(i => i.difference < 0).reduce((acc, i) => acc + Math.abs(i.difference), 0);
  const totalIn = items.filter(i => i.difference > 0).reduce((acc, i) => acc + i.difference, 0);
  const netChange = totalIn - totalOut;

  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No hay diferencias respecto a la carga anterior.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border rounded-md p-3 text-center">
          <p className="text-xs text-muted-foreground">Salidas (vendido/removido)</p>
          <p className="text-2xl font-bold text-red-600">{totalOut}</p>
        </div>
        <div className="border rounded-md p-3 text-center">
          <p className="text-xs text-muted-foreground">Entradas</p>
          <p className="text-2xl font-bold text-green-700">{totalIn}</p>
        </div>
        <div className="border rounded-md p-3 text-center">
          <p className="text-xs text-muted-foreground">Neto</p>
          <p className={`text-2xl font-bold ${netChange >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {netChange >= 0 ? '+' : ''}{netChange}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Producto</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Anterior</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Actual</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(item => (
              <tr key={item.externalIdentifier} className="hover:bg-muted/20">
                <td className="px-3 py-2">
                  <p className="font-medium truncate max-w-xs">
                    {item.internalProductName ?? item.externalName}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{item.externalIdentifier}</span>
                    {item.internalSku && (
                      <Badge variant="outline" className="text-xs">SKU: {item.internalSku}</Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">{item.previousStock}</td>
                <td className="px-3 py-2 text-right font-medium">{item.currentStock}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`inline-flex items-center gap-1 font-semibold ${
                    item.difference < 0 ? 'text-red-600' :
                    item.difference > 0 ? 'text-green-700' : 'text-muted-foreground'
                  }`}>
                    {item.difference < 0 && <ArrowDown className="h-3 w-3" />}
                    {item.difference > 0 && <ArrowUp className="h-3 w-3" />}
                    {item.difference === 0 && <Minus className="h-3 w-3" />}
                    {item.difference > 0 ? '+' : ''}{item.difference}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
