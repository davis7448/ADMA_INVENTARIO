"use server";

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc, runTransaction } from "firebase/firestore";
import type { DispatchOrder } from '@/lib/types';

export async function reconcileCancelledExceptions(): Promise<{ reconciled: number; errors: string[] }> {
  const errors: string[] = [];
  let reconciled = 0;

  try {
    // Fetch all dispatch orders with cancelledExceptions
    const ordersQuery = query(collection(db, 'dispatchOrders'), where('cancelledExceptions', '!=', null));
    const ordersSnapshot = await getDocs(ordersQuery);

    const ordersToUpdate: { id: string; cancelledExceptions: any[] }[] = [];

    for (const orderDoc of ordersSnapshot.docs) {
      const order = { id: orderDoc.id, ...orderDoc.data() } as DispatchOrder;

      if (!order.cancelledExceptions || order.cancelledExceptions.length === 0) continue;

      const validExceptions: any[] = [];

      for (const exception of order.cancelledExceptions) {
        // Check if corresponding "Anulado" movement exists
        const movementsQuery = query(
          collection(db, 'inventoryMovements'),
          where('type', '==', 'Anulado'),
          where('dispatchId', '==', order.dispatchId)
        );

        const movementsSnapshot = await getDocs(movementsQuery);
        const hasMovement = movementsSnapshot.docs.some(doc => {
          const data = doc.data();
          return data.notes && data.notes.includes(exception.trackingNumber);
        });

        if (hasMovement) {
          // Movement exists, keep the exception
          validExceptions.push(exception);
        } else {
          // No movement found, this exception should be removed
          console.log(`Removing orphaned cancelledException for order ${order.dispatchId}, tracking: ${exception.trackingNumber}`);
        }
      }

      if (validExceptions.length !== order.cancelledExceptions.length) {
        ordersToUpdate.push({
          id: order.id,
          cancelledExceptions: validExceptions
        });
      }
    }

    // Update orders in batch
    for (const orderUpdate of ordersToUpdate) {
      try {
        await runTransaction(db, async (transaction) => {
          const orderRef = doc(db, 'dispatchOrders', orderUpdate.id);
          transaction.update(orderRef, { cancelledExceptions: orderUpdate.cancelledExceptions });
        });
        reconciled++;
      } catch (error) {
        errors.push(`Failed to update order ${orderUpdate.id}: ${error}`);
      }
    }

  } catch (error) {
    errors.push(`Reconciliation failed: ${error}`);
  }

  return { reconciled, errors };
}