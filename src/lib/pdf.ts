import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatToTimeZone } from '@/lib/utils';

interface PdfProduct {
    sku: string;
    name: string;
    dispatchQuantity: number;
}

export const generatePickingListPDF = (
    dispatchId: string, 
    products: PdfProduct[], 
    platformName: string, 
    carrierName: string,
    date: Date | string
): string => {
    const doc = new jsPDF();
    const dispatchDate = typeof date === 'string' ? new Date(date) : date;
    
    doc.setFontSize(20);
    doc.text("Picking List", 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Dispatch ID: ${dispatchId}`, 15, 35);
    doc.text(`Date: ${formatToTimeZone(dispatchDate, 'dd/MM/yyyy HH:mm')}`, 15, 42);
    doc.text(`Platform: ${platformName}`, 15, 49);
    doc.text(`Carrier: ${carrierName}`, 15, 56);

    const tableColumn = ["SKU", "Product Name", "Quantity"];
    const tableRows: (string|number)[][] = [];

    products.forEach(product => {
        const productData = [
            product.sku,
            product.name,
            product.dispatchQuantity
        ];
        tableRows.push(productData);
    });

    // @ts-ignore - jspdf types might not be perfectly up to date with autoTable
    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 65,
    });
    
    return doc.output('datauristring', { filename: `picking-list-${dispatchId.replace(/\s/g, '-')}.pdf` }).split(',')[1];
};
