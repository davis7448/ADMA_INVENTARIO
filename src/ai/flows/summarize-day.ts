'use server';
/**
 * @fileOverview A flow to summarize daily inventory and sales data.
 *
 * - summarizeDay - A function that aggregates data for a specific day and stores it.
 * - SummarizeDayInput - The input type for the summarizeDay function.
 * - SummarizeDayOutput - The return type for the summarizeDay function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getDispatchOrders, getInventoryMovements } from '@/lib/api';
import { format, startOfDay, endOfDay } from 'date-fns';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { DashboardData } from '@/lib/types';

const SummarizeDayInputSchema = z.object({
  date: z.string().describe('The date to summarize in YYYY-MM-DD format.'),
  warehouseId: z.string().optional().describe('The warehouse ID to summarize.'),
});
export type SummarizeDayInput = z.infer<typeof SummarizeDayInputSchema>;

const SummarizeDayOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  warehouseId: z.string(),
  date: z.string(),
});
export type SummarizeDayOutput = z.infer<typeof SummarizeDayOutputSchema>;


export async function summarizeDay(input: SummarizeDayInput): Promise<SummarizeDayOutput> {
    return summarizeDayFlow(input);
}


const summarizeDayFlow = ai.defineFlow(
    {
      name: 'summarizeDayFlow',
      inputSchema: SummarizeDayInputSchema,
      outputSchema: SummarizeDayOutputSchema,
    },
    async (input) => {
        const targetDate = new Date(input.date + 'T00:00:00'); // Ensure date is parsed as local
        const warehouseId = input.warehouseId || 'wh-bog';

        const dateStart = startOfDay(targetDate);
        const dateEnd = endOfDay(targetDate);

        const [ordersResult, movementsResult] = await Promise.all([
            getDispatchOrders({ 
                fetchAll: true, 
                filters: { 
                    warehouseId, 
                    startDate: dateStart.toISOString(), 
                    endDate: dateEnd.toISOString() 
                } 
            }),
            getInventoryMovements({ 
                fetchAll: true, 
                filters: { 
                    warehouseId, 
                    startDate: dateStart.toISOString(), 
                    endDate: dateEnd.toISOString() 
                } 
            }),
        ]);

        let totalItemsDispatched = 0;
        let totalAnnulledItems = 0;
        
        ordersResult.orders.forEach(order => {
            let dispatchedInOrder = order.products.reduce((sum, p) => sum + p.quantity, 0);
            if (order.status === 'Parcial' && order.exceptions) {
                const exceptionsTotal = order.exceptions.reduce((sum, ex) => sum + ex.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
                dispatchedInOrder -= exceptionsTotal;
            }
            if (order.cancelledExceptions) {
                const cancelledTotal = order.cancelledExceptions.reduce((sum, ex) => sum + ex.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
                totalAnnulledItems += cancelledTotal;
                dispatchedInOrder -= cancelledTotal;
            }
            totalItemsDispatched += dispatchedInOrder;
        });

        let totalPendingUnits = 0;
        ordersResult.orders.filter(o => o.status === 'Pendiente' || o.status === 'Parcial').forEach(order => {
            if (order.status === 'Pendiente') {
                totalPendingUnits += order.totalItems;
            } else if (order.status === 'Parcial' && order.exceptions) {
                totalPendingUnits += order.exceptions.reduce((sum, ex) => sum + ex.products.reduce((pSum, p) => pSum + p.quantity, 0), 0);
            }
        });
        
        let totalReturns = 0;
        let totalAdjustIn = 0;
        let totalAdjustOut = 0;
        
        movementsResult.movements.forEach(m => {
            if (m.type === 'Entrada' && (m.notes.toLowerCase().includes('devolución') || m.notes.toLowerCase().includes('averia'))) {
                totalReturns += m.quantity;
            } else if (m.type === 'Ajuste de Entrada') {
                totalAdjustIn += m.quantity;
            } else if (m.type === 'Ajuste de Salida') {
                totalAdjustOut += m.quantity;
            }
        });

        const summaryData: Omit<DashboardData, 'chartData' | 'pendingChartData' | 'returnsChartData' | 'annulledChartData' | 'adjustInChartData' | 'adjustOutChartData' | 'productChartData' | 'categoryChartData' | 'platformCarrierChartData' | 'allCarrierNames' | 'mostUsedCarrier' | 'platformWithMostOrders' | 'dailyDispatchSummaryData'> = {
            totalItemsDispatched,
            totalAnnulledItems,
            totalPendingUnits,
            totalReturns,
            totalAdjustIn,
            totalAdjustOut,
        };
        
        const docId = `${format(targetDate, 'yyyy-MM-dd')}_${warehouseId}`;
        const summaryRef = doc(db, 'dailySummaries', docId);
        
        await setDoc(summaryRef, summaryData);
        
        return {
            success: true,
            message: `Successfully summarized data for ${input.date} in warehouse ${warehouseId}.`,
            warehouseId: warehouseId,
            date: input.date,
        };
    }
);
