import { Sale } from '../types/sale';
import { Store } from '../types/store';
import { BusinessSettings } from '../types/settings';

export const generateWhatsAppShareUrl = (
  sale: Sale,
  phoneNumber: string,
  store?: Store | null,
  settings?: BusinessSettings | null
): string => {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  // Format international code (if 10 digits in India, add 91)
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  const businessName = settings?.businessName || 'RARAJU ENTERPRISES';
  const storeName = store?.name || sale.storeName || 'Main Branch';
  const dateStr = new Date(sale.createdAt).toLocaleDateString('en-IN');

  const itemsList = sale.items
    .map((item) => `▪️ *${item.productName}*: ${item.quantity} ${item.unit} x ₹${item.actualPrice.toFixed(2)} = ₹${item.total.toFixed(2)}`)
    .join('\n');

  const message = 
`🧾 *TAX INVOICE - ${businessName}*
📍 *Store:* ${storeName}
🔢 *Invoice No:* ${sale.invoiceNumber}
📅 *Date:* ${dateStr}
👤 *Billed By:* ${sale.employeeName}

📋 *ITEMS:*
${itemsList}

------------------------
💵 *Subtotal:* ₹${sale.subtotal.toFixed(2)}
${sale.totalGst > 0 ? `🏛️ *GST:* ₹${sale.totalGst.toFixed(2)}\n` : ''}${sale.totalDiscount > 0 ? `🏷️ *Discount:* -₹${sale.totalDiscount.toFixed(2)}\n` : ''}💰 *TOTAL AMOUNT:* ₹${sale.grandTotal.toFixed(2)}
💳 *Payment Mode:* ${sale.paymentMethod}
------------------------
🙏 *${settings?.invoiceFooterMessage || 'Thank you for shopping with us! Visit again.'}*`;

  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
};
