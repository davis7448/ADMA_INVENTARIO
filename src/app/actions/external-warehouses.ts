"use server";

import { revalidatePath } from 'next/cache';
import {
  updateWarehouseColumnConfig,
  getExternalProductMappings,
  addExternalProductMappings,
  deleteExternalProductMapping,
  updateExternalProductMapping,
  addExternalStockSnapshot,
  addExternalStockSnapshotItems,
  getExternalStockSnapshots,
  getExternalStockSnapshotItems,
  updateSnapshotItemMapping,
  getExternalRotationData,
  getExternalWarehouses,
  getLatestExternalStockByProductIds,
  type ExternalStockSummaryMap,
} from '@/lib/api';
import type {
  ExternalColumnConfig,
  ExternalProductMapping,
  ExternalStockSnapshot,
  ExternalStockSnapshotItem,
  ExternalRotationItem,
  Warehouse,
} from '@/lib/types';

export async function updateColumnConfigAction(
  warehouseId: string,
  config: ExternalColumnConfig
): Promise<{ success: boolean; message: string }> {
  try {
    await updateWarehouseColumnConfig(warehouseId, config);
    revalidatePath('/settings');
    revalidatePath('/external-warehouses');
    return { success: true, message: 'Configuración de columnas guardada.' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, message: msg };
  }
}

export interface ParsedExternalRow {
  externalIdentifier: string;
  externalName: string;
  stockQuantity: number;
  rawData: Record<string, string | number | boolean | null>;
}

export interface UploadExternalStockResult {
  success: boolean;
  message: string;
  snapshotId?: string;
  mapped: (ParsedExternalRow & { mappingId: string; internalSku: string; internalProductId: string })[];
  unmapped: ParsedExternalRow[];
}

export async function uploadExternalStockAction(
  warehouseId: string,
  rows: ParsedExternalRow[],
  fileName: string,
  uploadedBy: { id: string; name: string }
): Promise<UploadExternalStockResult> {
  try {
    const existingMappings = await getExternalProductMappings(warehouseId);
    const mappingByIdentifier = new Map(existingMappings.map(m => [m.externalIdentifier, m]));

    const mapped: UploadExternalStockResult['mapped'] = [];
    const unmapped: ParsedExternalRow[] = [];

    for (const row of rows) {
      const existing = mappingByIdentifier.get(row.externalIdentifier);
      if (existing) {
        mapped.push({
          ...row,
          mappingId: existing.id,
          internalSku: existing.internalSku,
          internalProductId: existing.internalProductId,
        });
      } else {
        unmapped.push(row);
      }
    }

    const snapshotId = await addExternalStockSnapshot({
      warehouseId,
      uploadedBy,
      fileName,
      totalProducts: rows.length,
      mappedProducts: mapped.length,
      unmappedProducts: unmapped.length,
      status: unmapped.length === 0 ? 'complete' : 'partial',
    });

    const items: Omit<ExternalStockSnapshotItem, 'id'>[] = [
      ...mapped.map(r => ({
        snapshotId,
        warehouseId,
        externalIdentifier: r.externalIdentifier,
        externalName: r.externalName,
        stockQuantity: r.stockQuantity,
        mappingId: r.mappingId,
        internalProductId: r.internalProductId,
        internalSku: r.internalSku,
        rawData: r.rawData,
      })),
      ...unmapped.map(r => ({
        snapshotId,
        warehouseId,
        externalIdentifier: r.externalIdentifier,
        externalName: r.externalName,
        stockQuantity: r.stockQuantity,
        mappingId: null,
        internalProductId: null,
        internalSku: null,
        rawData: r.rawData,
      })),
    ];

    await addExternalStockSnapshotItems(items);
    revalidatePath('/external-warehouses');

    return { success: true, message: 'Carga registrada correctamente.', snapshotId, mapped, unmapped };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, message: msg, mapped: [], unmapped: [] };
  }
}

export interface NewMappingInput {
  externalIdentifier: string;
  externalName: string;
  internalProductId: string;
  internalSku: string;
  internalProductName: string;
}

export async function saveNewMappingsAction(
  warehouseId: string,
  snapshotId: string,
  newMappings: NewMappingInput[]
): Promise<{ success: boolean; message: string }> {
  try {
    const toCreate = newMappings.map(m => ({
      warehouseId,
      externalIdentifier: m.externalIdentifier,
      externalName: m.externalName,
      internalProductId: m.internalProductId,
      internalSku: m.internalSku,
      internalProductName: m.internalProductName,
    }));

    const ids = await addExternalProductMappings(toCreate);

    // Update snapshot items with the new mappingIds
    await Promise.all(
      newMappings.map((m, i) =>
        updateSnapshotItemMapping(snapshotId, m.externalIdentifier, ids[i], m.internalProductId, m.internalSku)
      )
    );

    revalidatePath('/external-warehouses');
    return { success: true, message: `${newMappings.length} mapeo(s) guardado(s).` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, message: msg };
  }
}

export async function deleteMappingAction(
  mappingId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await deleteExternalProductMapping(mappingId);
    revalidatePath('/external-warehouses');
    return { success: true, message: 'Mapeo eliminado.' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, message: msg };
  }
}

export async function updateMappingAction(
  mappingId: string,
  data: { internalProductId: string; internalSku: string; internalProductName: string }
): Promise<{ success: boolean; message: string }> {
  try {
    await updateExternalProductMapping(mappingId, data);
    revalidatePath('/external-warehouses');
    return { success: true, message: 'Mapeo actualizado.' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, message: msg };
  }
}

export async function getRotationDataAction(
  warehouseId: string,
  snapshotId: string
): Promise<{ success: boolean; data: ExternalRotationItem[]; message?: string }> {
  try {
    const data = await getExternalRotationData(warehouseId, snapshotId);
    return { success: true, data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error inesperado.';
    return { success: false, data: [], message: msg };
  }
}

export async function getExternalWarehousesAction(): Promise<{ success: boolean; warehouses: Warehouse[] }> {
  try {
    const warehouses = await getExternalWarehouses();
    return { success: true, warehouses };
  } catch {
    return { success: false, warehouses: [] };
  }
}

export async function getSnapshotsAction(warehouseId: string): Promise<{ success: boolean; snapshots: ExternalStockSnapshot[] }> {
  try {
    const snapshots = await getExternalStockSnapshots(warehouseId);
    return { success: true, snapshots };
  } catch {
    return { success: false, snapshots: [] };
  }
}

export async function getSnapshotItemsAction(snapshotId: string): Promise<{ success: boolean; items: ExternalStockSnapshotItem[] }> {
  try {
    const items = await getExternalStockSnapshotItems(snapshotId);
    return { success: true, items };
  } catch {
    return { success: false, items: [] };
  }
}

export async function getMappingsAction(warehouseId: string): Promise<{ success: boolean; mappings: ExternalProductMapping[] }> {
  try {
    const mappings = await getExternalProductMappings(warehouseId);
    return { success: true, mappings };
  } catch {
    return { success: false, mappings: [] };
  }
}

export async function getExternalStockSummaryAction(productIds: string[]): Promise<{ success: boolean; summary: ExternalStockSummaryMap }> {
  try {
    const summary = await getLatestExternalStockByProductIds(productIds);
    return { success: true, summary };
  } catch {
    return { success: false, summary: {} };
  }
}
