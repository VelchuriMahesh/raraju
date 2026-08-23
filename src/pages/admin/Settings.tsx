import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Building2,
  Receipt,
  Check,
  Loader2,
  QrCode,
  IndianRupee,
  Copy
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { getBusinessSettings, saveBusinessSettings } from '../../services/settingsService';
import { UPIQRCode } from '../../components/common/UPIQRCode';

export const Settings: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { language } = useLanguage();

  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [defaultPrinterType, setDefaultPrinterType] = useState<'THERMAL_80MM' | 'A4'>('THERMAL_80MM');
  const [invoiceFooterMessage, setInvoiceFooterMessage] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getBusinessSettings();
      setBusinessName(data.businessName);
      setAddress(data.address);
      setPhone(data.phone);
      setEmail(data.email);
      setGstin(data.gstin || '');
      setUpiId(data.upiId || 'raraju@upi');
      setUpiPayeeName(data.upiPayeeName || 'RARAJU ENTERPRISES');
      setInvoicePrefix(data.invoicePrefix || 'INV-');
      setDefaultPrinterType(data.defaultPrinterType || 'THERMAL_80MM');
      setInvoiceFooterMessage(data.invoiceFooterMessage || '');
    } catch (err: any) {
      error('Failed to load settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSaving(true);
    try {
      await saveBusinessSettings(
        {
          businessName,
          address,
          phone,
          email,
          gstin,
          upiId: upiId.trim(),
          upiPayeeName: upiPayeeName.trim(),
          currencySymbol: '₹',
          invoicePrefix,
          defaultPrinterType,
          invoiceFooterMessage
        },
        currentUser
      );
      success('Settings updated successfully!');
    } catch (err: any) {
      error('Failed to save settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="text-xs font-bold text-slate-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-indigo-600" />
            <span>{language === 'te' ? 'వ్యాపార అమరికలు' : 'Business Settings & UPI Setup'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'te'
              ? 'వ్యాపార సమాచారం, యూపీఐ ఐడీ (QR కోడ్) మరియు ప్రింటింగ్ ప్రాధాన్యతలు'
              : 'Configure business profile, UPI ID for POS QR code billing, and receipts'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* UPI Payment Configuration */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-indigo-600" />
              <span>
                {language === 'te' ? 'యూపీఐ చెల్లింపుల అమరిక (UPI ID Setup)' : 'UPI Payments & Dynamic QR Code Setup'}
              </span>
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
              POS Dynamic QR
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block font-extrabold text-slate-800 mb-1">
                  {language === 'te' ? 'యూపీఐ ఐడీ (UPI ID / VPA) *' : 'Business UPI ID (VPA) *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. raraju@oksbi or 9876543210@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {language === 'te'
                    ? 'స్టోర్లలో కస్టమర్ యూపీఐ చెల్లింపు ఎంచుకున్నప్పుడు ఈ ఐడీతో డైనమిక్ క్యూఆర్ కోడ్ రూపొందించబడుతుంది'
                    : 'A dynamic QR code with the exact bill amount will be generated for customers to scan'}
                </p>
              </div>

              <div>
                <label className="block font-extrabold text-slate-800 mb-1">
                  {language === 'te' ? 'యూపీఐ రిసీవర్ పేరు (Payee Name) *' : 'UPI Payee Display Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RARAJU ENTERPRISES"
                  value={upiPayeeName}
                  onChange={(e) => setUpiPayeeName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white uppercase"
                />
              </div>
            </div>

            {/* Live QR Preview Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Live POS QR Preview (₹1,500 Example)
              </span>
              <UPIQRCode
                upiId={upiId || 'raraju@upi'}
                payeeName={upiPayeeName || 'RARAJU ENTERPRISES'}
                amount={1500}
                invoiceNumber="SAMPLE-01"
              />
            </div>
          </div>
        </div>

        {/* Business Identity */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span>Business Profile & Headquarters Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Business Name *</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">GSTIN Number (Optional)</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono uppercase focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Headquarters / Business Address *</label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Phone *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Official Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Invoice & Printing */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <span>Invoice & Bill Print Layout</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Default Printer Format</label>
              <select
                value={defaultPrinterType}
                onChange={(e) => setDefaultPrinterType(e.target.value as 'THERMAL_80MM' | 'A4')}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:bg-white"
              >
                <option value="THERMAL_80MM">Thermal 80mm Roll (POS Standard)</option>
                <option value="A4">Standard A4 Tax Invoice</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Global Invoice Prefix</label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:bg-white uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Receipt Footer Message</label>
            <input
              type="text"
              value={invoiceFooterMessage}
              onChange={(e) => setInvoiceFooterMessage(e.target.value)}
              placeholder="Thank you for your business! Visit again."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:bg-white"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
