import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

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
    date: Date = new Date()
) => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Picking List", 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Dispatch ID: ${dispatchId}`, 15, 35);
    doc.text(`Date: ${format(date, 'dd/MM/yyyy HH:mm')}`, 15, 42);
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

    doc.save(`picking-list-${dispatchId}.pdf`);
};
