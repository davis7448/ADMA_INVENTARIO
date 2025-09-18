
"use server";

import { generatePickingListPDF } from "@/lib/pdf";

type PdfProduct = {
    sku: string;
    name: string;
    dispatchQuantity: number;
};

export async function generatePickingListAction(
    dispatchId: string, 
    products: PdfProduct[], 
    platformName: string, 
    carrierName: string,
    date: string
): Promise<{ success: boolean; pdfData?: string; message?: string }> {
    try {
        const pdfData = generatePickingListPDF(dispatchId, products, platformName, carrierName, date);
        return { success: true, pdfData };
    } catch (error) {
        console.error("Error generating PDF:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message };
    }
}
