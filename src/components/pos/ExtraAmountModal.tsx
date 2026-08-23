import React, { useState } from 'react';
import { PlusCircle, X, Check, IndianRupee, Tag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ExtraAmountModalProps {
  currentExtraAmount: number;
  currentReason: string;
  onApply: (amount: number, reason: string) => void;
  onClose: () => void;
}

export const ExtraAmountModal: React.FC<ExtraAmountModalProps> = ({
  currentExtraAmount,
  currentReason,
  onApply,
  onClose
}) => {
  const { language } = useLanguage();
  const [amount, setAmount] = useState<string>(currentExtraAmount > 0 ? String(currentExtraAmount) : '');
  const [reason, setReason] = useState<string>(currentReason || '');
  const [error, setError] = useState<string | null>(null);

  const quickPresets = [
    { labelEn: 'Loading / Bag Fee', labelTe: 'లోడింగ్ / సంచి చార్జ్', amount: 20 },
    { labelEn: 'Delivery / Transport', labelTe: 'రవాణా చార్జ్', amount: 50 },
    { labelEn: 'Custom Extra', labelTe: 'అదనపు మొత్తం', amount: 100 },
    { labelEn: 'Service Charge', labelTe: 'సర్వీస్ చార్జ్', amount: 150 }
  ];

  const handleSelectPreset = (preset: { labelEn: string; labelTe: string; amount: number }) => {
    setAmount(String(preset.amount));
    setReason(language === 'te' ? preset.labelTe : preset.labelEn);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount) || 0;
    if (num < 0) {
      setError(language === 'te' ? 'అదనపు మొత్తం 0 కంటే తక్కువగా ఉండకూడదు' : 'Extra amount cannot be negative.');
      return;
    }

    onApply(num, reason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl text-slate-800 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                {language === 'te' ? 'అదనపు మొత్తం జోడించండి' : 'Add Extra Amount / Fee'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'te' ? 'బిల్లుకు అదనపు ఛార్జీలు కలపండి' : 'Add custom charges, delivery, or fees to the bill'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
            {language === 'te' ? 'త్వరిత ఎంపికలు (Quick Presets)' : 'Quick Presets'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {quickPresets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/40 text-left transition-all group"
              >
                <span className="text-xs font-bold text-slate-800 block group-hover:text-indigo-600">
                  +₹{p.amount}
                </span>
                <span className="text-[11px] text-slate-500 truncate block">
                  {language === 'te' ? p.labelTe : p.labelEn}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              {language === 'te' ? 'అదనపు మొత్తం (₹) *' : 'Extra Amount (₹) *'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-base">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                autoFocus
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 50"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-black text-lg focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              {language === 'te' ? 'వివరణ / కారణం (ఐచ్ఛికం)' : 'Reason / Note (Optional)'}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={language === 'te' ? 'ఉదా: లోడింగ్ లేదా డెలివరీ' : 'e.g. Loading Fee, Bag, Delivery'}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-600 font-semibold">{error}</p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            {currentExtraAmount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onApply(0, '');
                  onClose();
                }}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl font-bold text-xs mr-auto transition-colors"
              >
                {language === 'te' ? 'తొలగించు' : 'Remove Extra'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl font-bold transition-colors"
            >
              {language === 'te' ? 'రద్దు' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>{language === 'te' ? 'వర్తింపజేయి' : 'Apply Extra Amount'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
