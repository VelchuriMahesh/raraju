import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale } from '../types/sale';
import { Store } from '../types/store';
import { BusinessSettings } from '../types/settings';

export const generateInvoicePDF = (
  sale: Sale,
  store?: Store | null,
  settings?: BusinessSettings | null,
  format: 'a4' | 'thermal' = 'a4'
): jsPDF => {
  if (format === 'thermal') {
    return generateThermalPDF(sale, store, settings);
  }
  return generateA4PDF(sale, store, settings);
};

const generateA4PDF = (
  sale: Sale,
  store?: Store | null,
  settings?: BusinessSettings | null
): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const businessName = settings?.businessName || 'RARAJU ENTERPRISES';
  const storeName = store?.name || sale.storeName || 'Main Branch';
  const storeAddress = store?.address || settings?.address || 'Andhra Pradesh, India';
  const storePhone = store?.phone || settings?.phone || '';
  const gstin = store?.gstin || settings?.gstin || '';

  // Header Banner
  doc.setFillColor(14, 165, 233); // brand-500
  doc.rect(0, 0, 210, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName, 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${storeName} | TAX INVOICE`, 14, 18);

  // Store & Invoice Meta Box
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.text(`Address: ${storeAddress}`, 14, 34);
  if (storePhone) doc.text(`Phone: ${storePhone}`, 14, 39);
  if (gstin) doc.text(`GSTIN: ${gstin}`, 14, 44);

  // Invoice Details on Right
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice No: ${sale.invoiceNumber}`, 130, 34);
  doc.setFont('helvetica', 'normal');
  const dateObj = new Date(sale.createdAt);
  doc.text(`Date & Time: ${dateObj.toLocaleDateString('en-IN')} ${dateObj.toLocaleTimeString('en-IN')}`, 130, 39);
  doc.text(`Billed By: ${sale.employeeName}`, 130, 44);
  doc.text(`Payment Mode: ${sale.paymentMethod}`, 130, 49);

  // Customer Details (if present)
  let startY = 56;
  if (sale.customer && (sale.customer.name || sale.customer.phone)) {
    doc.setFillColor(245, 247, 250);
    doc.rect(14, startY, 182, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Details:', 18, startY + 5);
    doc.setFont('helvetica', 'normal');
    const custInfo = [
      sale.customer.name ? `Name: ${sale.customer.name}` : '',
      sale.customer.phone ? `Phone: ${sale.customer.phone}` : '',
      sale.customer.gstin ? `GST: ${sale.customer.gstin}` : ''
    ].filter(Boolean).join(' | ');
    doc.text(custInfo, 18, startY + 10);
    startY += 20;
  }

  // Items Table
  const tableData = sale.items.map((item, idx) => [
    idx + 1,
    item.productName + (item.customerRateApplied ? ' *' : ''),
    item.sku,
    `${item.quantity} ${item.unit}`,
    `Rs. ${item.actualPrice.toFixed(2)}`,
    item.gstRate > 0 ? `${item.gstRate}%` : '0%',
    `Rs. ${item.total.toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: startY,
    head: [['#', 'Item Description', 'SKU', 'Qty', 'Rate', 'GST', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [14, 165, 233],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 25, halign: 'right' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Summary Totals
  doc.setFontSize(9);
  doc.text(`Total Items: ${sale.itemCount}`, 14, finalY);
  if (sale.totalCustomerRateDifference !== 0) {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('* Rate override applied based on store policy', 14, finalY + 5);
  }

  // Summary Box on Right
  doc.setTextColor(30, 41, 59);
  const rightX = 135;
  doc.text(`Subtotal:`, rightX, finalY);
  doc.text(`Rs. ${sale.subtotal.toFixed(2)}`, 190, finalY, { align: 'right' });

  if (sale.totalGst > 0) {
    doc.text(`Total GST:`, rightX, finalY + 5);
    doc.text(`Rs. ${sale.totalGst.toFixed(2)}`, 190, finalY + 5, { align: 'right' });
  }

  if (sale.totalDiscount > 0) {
    doc.text(`Discount:`, rightX, finalY + 10);
    doc.text(`-Rs. ${sale.totalDiscount.toFixed(2)}`, 190, finalY + 10, { align: 'right' });
  }

  // Grand Total Box
  const grandTotalY = finalY + (sale.totalGst > 0 || sale.totalDiscount > 0 ? 16 : 8);
  doc.setFillColor(14, 165, 233);
  doc.rect(rightX - 3, grandTotalY - 4, 62, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`GRAND TOTAL:`, rightX, grandTotalY + 3);
  doc.text(`Rs. ${sale.grandTotal.toFixed(2)}`, 190, grandTotalY + 3, { align: 'right' });

  // Footer Message
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const footerMsg = settings?.invoiceFooterMessage || 'Thank you for your business! Visit again.';
  doc.text(footerMsg, 105, 280, { align: 'center' });

  return doc;
};

const generateThermalPDF = (
  sale: Sale,
  store?: Store | null,
  settings?: BusinessSettings | null
): jsPDF => {
  // 80mm width thermal receipt PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200 + (sale.items.length * 8)] // Dynamic receipt height
  });

  const businessName = settings?.businessName || 'RARAJU ENTERPRISES';
  const storeName = store?.name || sale.storeName || 'Main Branch';
  const storeAddress = store?.address || settings?.address || '';
  const storePhone = store?.phone || settings?.phone || '';
  const gstin = store?.gstin || settings?.gstin || '';

  let y = 10;

  // Center Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName, 40, y, { align: 'center' });
  y += 5;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(storeName, 40, y, { align: 'center' });
  y += 4;

  if (storeAddress) {
    doc.setFontSize(7.5);
    doc.text(storeAddress, 40, y, { align: 'center' });
    y += 4;
  }
  if (storePhone) {
    doc.text(`Ph: ${storePhone}`, 40, y, { align: 'center' });
    y += 4;
  }
  if (gstin) {
    doc.text(`GST: ${gstin}`, 40, y, { align: 'center' });
    y += 4;
  }

  // Divider
  doc.setLineDashPattern([1, 1], 0);
  doc.line(4, y, 76, y);
  y += 4;

  // Invoice Details
  doc.setFontSize(7.5);
  doc.text(`Invoice: ${sale.invoiceNumber}`, 4, y);
  y += 3.5;
  const dateObj = new Date(sale.createdAt);
  doc.text(`Date: ${dateObj.toLocaleDateString('en-IN')} ${dateObj.toLocaleTimeString('en-IN')}`, 4, y);
  y += 3.5;
  doc.text(`Cashier: ${sale.employeeName}`, 4, y);
  y += 3.5;

  if (sale.customer?.name || sale.customer?.phone) {
    doc.text(`Cust: ${sale.customer.name || ''} ${sale.customer.phone ? '(' + sale.customer.phone + ')' : ''}`, 4, y);
    y += 3.5;
  }

  // Divider
  doc.line(4, y, 76, y);
  y += 4;

  // Column Headers
  doc.setFont('helvetica', 'bold');
  doc.text('Item', 4, y);
  doc.text('Qty x Rate', 42, y);
  doc.text('Amt', 76, y, { align: 'right' });
  y += 3;
  doc.line(4, y, 76, y);
  y += 3.5;

  // Items
  doc.setFont('helvetica', 'normal');
  for (const item of sale.items) {
    doc.setFont('helvetica', 'bold');
    doc.text(item.productName, 4, y);
    y += 3;
    doc.setFont('helvetica', 'normal');
    doc.text(`${item.quantity} ${item.unit} x Rs.${item.actualPrice.toFixed(0)}`, 4, y);
    doc.text(`Rs.${item.total.toFixed(2)}`, 76, y, { align: 'right' });
    y += 4;
  }

  // Divider
  doc.line(4, y, 76, y);
  y += 4;

  // Totals
  doc.setFontSize(8);
  doc.text('Subtotal:', 35, y);
  doc.text(`Rs.${sale.subtotal.toFixed(2)}`, 76, y, { align: 'right' });
  y += 4;

  if (sale.totalGst > 0) {
    doc.text('GST Total:', 35, y);
    doc.text(`Rs.${sale.totalGst.toFixed(2)}`, 76, y, { align: 'right' });
    y += 4;
  }

  if (sale.totalDiscount > 0) {
    doc.text('Discount:', 35, y);
    doc.text(`-Rs.${sale.totalDiscount.toFixed(2)}`, 76, y, { align: 'right' });
    y += 4;
  }

  // Grand Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL:', 35, y);
  doc.text(`Rs.${sale.grandTotal.toFixed(2)}`, 76, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Paid via: ${sale.paymentMethod} (Rs.${sale.amountPaid.toFixed(2)})`, 4, y);
  y += 3.5;
  if (sale.changeDue > 0) {
    doc.text(`Change Returned: Rs.${sale.changeDue.toFixed(2)}`, 4, y);
    y += 3.5;
  }

  // Divider
  doc.line(4, y, 76, y);
  y += 4;

  // Footer message
  const footerMsg = settings?.invoiceFooterMessage || 'Thank you for shopping with us!';
  doc.setFontSize(7);
  doc.text(footerMsg, 40, y, { align: 'center' });

  return doc;
};
