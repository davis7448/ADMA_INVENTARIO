"use server";

import { runTransaction, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { InventoryMovement, DispatchOrder } from '@/lib/types';

export async function updateMovementWarehouseAction(movementId: string, warehouseId: string) {
  try {
    const movementRef = doc(db, 'inventoryMovements', movementId);
    await updateDoc(movementRef, { warehouseId });
    return { success: true };
  } catch (error) {
    console.error('Error updating movement warehouse:', error);
    return { success: false, error: 'Failed to update movement warehouse' };
  }
}

export async function updateOrderWarehouseAction(orderId: string, warehouseId: string) {
  try {
    const orderRef = doc(db, 'dispatchOrders', orderId);
    await updateDoc(orderRef, { warehouseId });
    return { success: true };
  } catch (error) {
    console.error('Error updating order warehouse:', error);
    return { success: false, error: 'Failed to update order warehouse' };
  }
}

export async function bulkUpdateMovementWarehousesAction(movementIds: string[], warehouseId: string) {
  try {
    const results = await Promise.allSettled(
      movementIds.map(id => updateMovementWarehouseAction(id, warehouseId))
    );

    const successful = results.filter(result => result.status === 'fulfilled' && result.value.success).length;
    const failed = results.length - successful;

    return {
      success: true,
      successful,
      failed,
      total: results.length
    };
  } catch (error) {
    console.error('Error bulk updating movement warehouses:', error);
    return { success: false, error: 'Failed to bulk update movement warehouses' };
  }
}

export async function bulkUpdateOrderWarehousesAction(orderIds: string[], warehouseId: string) {
  try {
    const results = await Promise.allSettled(
      orderIds.map(id => updateOrderWarehouseAction(id, warehouseId))
    );

    const successful = results.filter(result => result.status === 'fulfilled' && result.value.success).length;
    const failed = results.length - successful;

    return {
      success: true,
      successful,
      failed,
      total: results.length
    };
  } catch (error) {
    console.error('Error bulk updating order warehouses:', error);
    return { success: false, error: 'Failed to bulk update order warehouses' };
  }
}