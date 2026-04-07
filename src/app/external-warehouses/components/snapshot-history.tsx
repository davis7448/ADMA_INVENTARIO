"use client";

import { useState } from 'react';
import type { ExternalStockSnapshot } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileSpreadsheet, TrendingUp } from 'lucide-react';

interface Props {
  snapshots: ExternalStockSnapshot[];
  selectedSnapshotId: string | null;
  onSelectSnapshot: (id: string) => void;
}

export function SnapshotHistory({ snapshots, selectedSnapshotId, onSelectSnapshot }: Props) {
  if (snapshots.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        No hay cargas registradas para esta bodega.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {snapshots.map((snap, index) => (
        <div
          key={snap.id}
          className={`border rounded-md p-3 flex items-center justify-between gap-3 transition-colors ${
            selectedSnapshotId === snap.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{snap.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(snap.uploadedAt), "d MMM yyyy, HH:mm", { locale: es })} · {snap.uploadedBy.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{snap.totalProducts} productos</span>
                <span className="text-xs text-green-700">{snap.mappedProducts} mapeados</span>
                {snap.unmappedProducts > 0 && (
                  <span className="text-xs text-amber-600">{snap.unmappedProducts} sin mapeo</span>
                )}
                <Badge variant={snap.status === 'complete' ? 'outline' : 'secondary'} className="text-xs">
                  {snap.status === 'complete' ? 'Completo' : 'Parcial'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {index < snapshots.length - 1 && (
              <Button
                size="sm"
                variant={selectedSnapshotId === snap.id ? 'default' : 'outline'}
                onClick={() => onSelectSnapshot(snap.id)}
                title="Ver rotación vs carga anterior"
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Rotación
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
