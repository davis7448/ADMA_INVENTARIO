"use client";

import { useEffect, useState, useCallback } from 'react';
import type { ExternalProductMapping } from '@/lib/types';
import { getMappingsAction, deleteMappingAction } from '@/app/actions/external-warehouses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Search } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  warehouseId: string;
}

export function MappingManagement({ warehouseId }: Props) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<ExternalProductMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ExternalProductMapping | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMappingsAction(warehouseId).then(res => {
      if (res.success) setMappings(res.mappings);
      setLoading(false);
    });
  }, [warehouseId]);

  useEffect(() => { load(); }, [load]);

  const filtered = mappings.filter(m => {
    const term = search.toLowerCase();
    return (
      m.externalIdentifier.toLowerCase().includes(term) ||
      m.externalName.toLowerCase().includes(term) ||
      m.internalSku.toLowerCase().includes(term) ||
      m.internalProductName.toLowerCase().includes(term)
    );
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deleteMappingAction(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
    if (result.success) {
      toast({ title: '¡Éxito!', description: result.message });
      load();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID externo, nombre o SKU..."
            className="pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {mappings.length === 0 ? 'No hay mapeos configurados aún.' : 'Sin resultados.'}
          </p>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">ID externo</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Nombre externo</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU interno</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden md:table-cell">Producto interno</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs">{m.externalIdentifier}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px] hidden sm:table-cell">{m.externalName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.internalSku}</td>
                    <td className="px-3 py-2 truncate max-w-[180px] hidden md:table-cell">{m.internalProductName}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(m)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && (
          <p className="text-xs text-muted-foreground text-right">
            {filtered.length} de {mappings.length} mapeo(s)
          </p>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar mapeo?</AlertDialogTitle>
            <AlertDialogDescription>
              El ID externo <span className="font-mono">{deleteTarget?.externalIdentifier}</span> ya no se mapeará automáticamente a <span className="font-medium">{deleteTarget?.internalProductName}</span>.
              Las próximas cargas requerirán mapeo manual para este producto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
