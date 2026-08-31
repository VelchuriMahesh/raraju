import React, { useState, useEffect } from 'react';
import {
  Banknote,
  QrCode,
  CreditCard,
  UserCheck,
  Split,
  CheckCircle2,
  X,
  Phone,
  User,
  AlertCircle
} from 'lucide-react';
import { PaymentMethod, SplitPaymentDetail, SaleCustomerInfo } from '../../types/sale';
import { useLanguage } from '../../context/LanguageContext';
import { UPIQRCode } from '../common/UPIQRCode';
import { getBusinessSettings } from '../../services/settingsService';

interface PaymentModalProps {
  grandTotal: number;
  extraAmount?: number;
  extraAmountReason?: string;
  onComplete: (paymentData: {
    paymentMethod: PaymentMethod;
    splitPayments?: SplitPaymentDetail[];
    amountPaid: number;
    customer?: SaleCustomerInfo;
    notes?: string;
  }) => void;
  onClose: () => void;
  isProcessing: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  grandTotal,
  extraAmount = 0,
  extraAmountReason = '',
  onComplete,
  onClose,
  isProcessing
}) => {
  const { t, language } = useLanguage();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amountPaidInput, setAmountPaidInput] = useState<string>(String(grandTotal));
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [cashAmount, setCashAmount] = useState<string>('0');
  const [upiAmount, setUpiAmount] = useState<string>('0');
  const [cardAmount, setCardAmount] = useState<string>('0');
  const [creditAmount, setCreditAmount] = useState<string>('0');

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [upiId, setUpiId] = useState<string>('raraju@upi');
  const [upiPayeeName, setUpiPayeeName] = useState<string>('RARAJU ENTERPRISES');

  useEffect(() => {
    getBusinessSettings().then((settings) => {
      if (settings.upiId) setUpiId(settings.upiId);
      if (settings.upiPayeeName) setUpiPayeeName(settings.upiPayeeName);
    });
  }, []);

  const paymentModes = [
    { id: 'CASH', en: 'Cash', te: 'నగదు', icon: Banknote },
    { id: 'UPI', en: 'UPI / QR', te: 'యూపీఐ', icon: QrCode },
    { id: 'CARD', en: 'Card', te: 'కార్డు', icon: CreditCard },
    { id: 'CREDIT', en: 'Store Credit', te: 'అరువు', icon: UserCheck }
  ];

  const handleMethodSelect = (m: PaymentMethod) => {
    setMethod(m);
    setError(null);
    if (m === 'CASH' || m === 'UPI' || m === 'CARD' || m === 'CREDIT') {
      setAmountPaidInput(String(grandTotal));
    }
  };

  const handleQuickCash = (amount: number) => {
    setAmountPaidInput(String(amount));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let customer: SaleCustomerInfo | undefined = undefined;
    if (customerName.trim() || customerPhone.trim()) {
      customer = {
        name: customerName.trim() || 'Customer',
        phone: customerPhone.trim()
      };
    }

    if (method === 'CASH') {
      const paid = parseFloat(amountPaidInput);
      if (isNaN(paid) || paid < grandTotal) {
        setError(`Tendered cash must be at least ₹${grandTotal.toFixed(2)}`);
        return;
      }
      onComplete({
        paymentMethod: 'CASH',
        amountPaid: paid,
        customer,
        notes: notes.trim()
      });
      return;
    }

    if (method === 'UPI' || method === 'CARD' || method === 'CREDIT') {
      onComplete({
        paymentMethod: method,
        amountPaid: grandTotal,
        customer,
        notes: notes.trim()
      });
      return;
    }

    // Default
    onComplete({
      paymentMethod: method,
      amountPaid: grandTotal,
      customer,
      notes: notes.trim()
    });
  };

  const cashPaidVal = parseFloat(amountPaidInput) || 0;
  const changeDue = Math.max(0, cashPaidVal - grandTotal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 pt-1">
          <div>
            <h3 className="font-black text-xl text-slate-900 leading-snug">{t('paymentAndCheckout')}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t('selectPaymentMethod')}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grand Total Highlight */}
        <div className="mt-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('grandTotal')}</span>
            <p className="text-3xl font-black text-emerald-600 font-mono mt-0.5">₹{grandTotal.toFixed(2)}</p>
            {extraAmount > 0 && (
              <span className="text-xs text-amber-700 font-semibold mt-1 block">
                Includes +₹{extraAmount.toFixed(2)} ({extraAmountReason || 'Extra Fee'})
              </span>
            )}
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-extrabold border border-indigo-200">
            {method}
          </div>
        </div>

        {/* Payment Methods Grid */}
        <div className="mt-5">
          <label className="block text-xs font-bold text-slate-700 mb-2">{t('selectPaymentMethod')}</label>
          <div className="grid grid-cols-4 gap-2">
            {paymentModes.map((pm) => {
              const Icon = pm.icon;
              const isSelected = method === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => handleMethodSelect(pm.id as PaymentMethod)}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border text-center transition-all min-h-[72px] ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-[1.02]'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                  <span className="text-xs font-bold leading-tight line-clamp-1">
                    {language === 'te' ? pm.te : pm.en}
                  </span>
                  {language === 'dual' && (
                    <span className={`text-[10px] leading-tight mt-0.5 font-medium line-clamp-1 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                      {pm.te}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic UPI QR Code when UPI is selected */}
        {method === 'UPI' && (
          <div className="mt-4 animate-scale-up">
            <UPIQRCode
              upiId={upiId}
              payeeName={upiPayeeName}
              amount={grandTotal}
              invoiceNumber="NEW_BILL"
            />
          </div>
        )}

        {/* Cash Tendered & Change */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          {method === 'CASH' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                {t('cashTendered')} (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">₹</span>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  value={amountPaidInput}
                  onChange={(e) => setAmountPaidInput(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-black text-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[grandTotal, Math.ceil(grandTotal / 50) * 50, Math.ceil(grandTotal / 100) * 100, Math.ceil(grandTotal / 500) * 500, 2000]
                  .filter((v, i, arr) => v >= grandTotal && arr.indexOf(v) === i)
                  .slice(0, 4)
                  .map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickCash(amt)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-mono font-bold rounded-lg border border-slate-200 transition-colors shadow-sm"
                    >
                      ₹{amt}
                    </button>
                  ))}
              </div>

              {changeDue > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800">{t('changeDue')}:</span>
                  <span className="text-xl font-black text-emerald-700 font-mono">₹{changeDue.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Customer Details */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>{language === 'te' ? 'కస్టమర్ వివరాలు (వాట్సాప్ బిల్లు కోసం)' : 'Customer Details (For WhatsApp Bill)'}</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  type="text"
                  placeholder={t('customerName')}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  placeholder={t('customerPhone')}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-2xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isProcessing ? 'Processing...' : `${t('completePayment')} (₹${grandTotal.toFixed(2)})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
