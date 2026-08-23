import React, { useState } from 'react';
import {
  CheckCircle,
  FileDown,
  Printer,
  Share2,
  PlusCircle,
  Phone,
  ExternalLink
} from 'lucide-react';
import { Sale } from '../../types/sale';
import { generateInvoicePDF } from '../../services/pdfService';
import { generateWhatsAppShareUrl } from '../../services/whatsappService';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

interface InvoiceSuccessModalProps {
  sale: Sale;
  onNewBill: () => void;
}

export const InvoiceSuccessModal: React.FC<InvoiceSuccessModalProps> = ({
  sale,
  onNewBill
}) => {
  const { t, language } = useLanguage();
  const { success, error } = useToast();
  const [whatsAppPhone, setWhatsAppPhone] = useState(sale.customer?.phone || '');

  const handleDownloadPDF = (format: 'a4' | 'thermal') => {
    try {
      const doc = generateInvoicePDF(sale, null, null, format);
      doc.save(`${sale.invoiceNumber}_${format}.pdf`);
      success(`Invoice ${sale.invoiceNumber} (${format.toUpperCase()}) downloaded.`);
    } catch (err: any) {
      error('Failed to generate PDF: ' + err.message);
    }
  };

  const handlePrint = (format: 'a4' | 'thermal') => {
    try {
      const doc = generateInvoicePDF(sale, null, null, format);
      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      } else {
        doc.autoPrint();
        doc.output('dataurlnewwindow');
      }
    } catch (err: any) {
      error('Print preview failed: ' + err.message);
    }
  };

  const handleWhatsAppShare = () => {
    if (!whatsAppPhone || whatsAppPhone.trim().length < 10) {
      error(language === 'te' ? 'దయచేసి 10 అంకెల వాట్సాప్ నంబర్‌ను నమోదు చేయండి' : 'Please enter valid 10-digit WhatsApp number');
      return;
    }
    const url = generateWhatsAppShareUrl(sale, whatsAppPhone);
    window.open(url, '_blank');
    success('Opened WhatsApp with formatted invoice summary.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-slate-800 relative text-center animate-scale-up">
        {/* Success Check Badge */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3.5 shadow-sm">
          <CheckCircle className="w-9 h-9" />
        </div>

        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t('saleCompleted')}</h2>
        <p className="text-xs text-slate-500 mt-1">
          {language === 'te'
            ? 'ఇన్వాయిస్ సృష్టించబడింది & స్టాక్ ఆటోమేటిక్‌గా తగ్గించబడింది'
            : 'Invoice created & stock deducted atomically'}
        </p>

        {/* Invoice Summary Box */}
        <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs text-slate-500 font-medium">{t('invoiceNumber')}</span>
            <span className="text-sm font-black text-indigo-700 font-mono tracking-wider">{sale.invoiceNumber}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs text-slate-500 font-medium">{t('grandTotal')}</span>
            <span className="text-2xl font-black text-emerald-600 font-mono">₹{sale.grandTotal.toFixed(2)}</span>
          </div>

          {sale.extraAmount && sale.extraAmount > 0 && (
            <div className="flex items-center justify-between text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              <span>Extra Fee ({sale.extraAmountReason || 'Additional'}):</span>
              <span className="font-mono font-bold">+₹{sale.extraAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>Store: <strong className="text-slate-800">{sale.storeName}</strong></span>
            <span>Mode: <strong className="text-slate-800">{sale.paymentMethod}</strong></span>
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {/* Download A4 PDF */}
          <button
            onClick={() => handleDownloadPDF('a4')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 transition-all group"
          >
            <FileDown className="w-5 h-5 text-indigo-600 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">{t('downloadA4')}</span>
          </button>

          {/* Download Thermal 80mm PDF */}
          <button
            onClick={() => handleDownloadPDF('thermal')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition-all group"
          >
            <FileDown className="w-5 h-5 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">{t('downloadReceipt')}</span>
          </button>

          {/* Print Thermal */}
          <button
            onClick={() => handlePrint('thermal')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-700 border border-slate-200 transition-all group"
          >
            <Printer className="w-5 h-5 text-amber-600 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold">{t('printReceipt')}</span>
          </button>
        </div>

        {/* WhatsApp Share Section */}
        <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>{t('whatsAppInvoice')}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                placeholder={t('customerPhone')}
                value={whatsAppPhone}
                onChange={(e) => setWhatsAppPhone(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={handleWhatsAppShare}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1 flex-shrink-0"
            >
              <span>{language === 'te' ? 'పంపండి' : 'Send'}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Next Bill Button */}
        <button
          onClick={onNewBill}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-600/20 transition-all scale-100 hover:scale-[1.01]"
        >
          <PlusCircle className="w-5 h-5" />
          <span>{t('startNewBill')}</span>
        </button>
      </div>
    </div>
  );
};
