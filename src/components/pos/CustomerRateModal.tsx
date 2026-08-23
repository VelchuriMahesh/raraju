import React, { useState } from 'react';
import { Tag, AlertCircle, Check, X, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Product } from '../../types/product';

interface CustomerRateModalProps {
  product: Product;
  currentActualPrice: number;
  currentReason?: string;
  onApply: (actualPrice: number, reason: string) => void;
  onClose: () => void;
}

export const CustomerRateModal: React.FC<CustomerRateModalProps> = ({
  product,
  currentActualPrice,
  currentReason,
  onApply,
  onClose
}) => {
  const [rateInput, setRateInput] = useState<string>(String(currentActualPrice));
  const [reason, setReason] = useState<string>(currentReason || 'Customer special rate');
  const [customReason, setCustomReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const policy = product.customerRatePolicy || { enabled: true, allowDecrease: false };
  const standardPrice = product.standardPrice;

  // Calculate allowed min & max
  const minPrice = policy.minAllowedPrice ?? (policy.allowDecrease ? 0 : standardPrice);
  const maxPrice = policy.maxAllowedPrice ?? (policy.maxIncrease ? standardPrice + policy.maxIncrease : standardPrice + 500);

  const standardReasons = [
    'Customer special rate',
    'Market price variation',
    'Bulk order adjustment',
    'Premium quality batch',
    'Special promotion',
    'Other'
  ];

  const handleRateChange = (val: string) => {
    setRateInput(val);
    setError(null);
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedRate = parseFloat(rateInput);

    if (isNaN(parsedRate) || parsedRate <= 0) {
      setError('Please enter a valid rate greater than 0.');
      return;
    }

    if (parsedRate < minPrice) {
      setError(`Rate cannot be below ₹${minPrice.toFixed(2)} based on store policy.`);
      return;
    }

    if (parsedRate > maxPrice) {
      setError(`Rate cannot exceed maximum allowed ₹${maxPrice.toFixed(2)} based on store policy.`);
      return;
    }

    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    if (policy.requireReason && (!finalReason || finalReason === '')) {
      setError('A reason is required for applying customer rate.');
      return;
    }

    onApply(parsedRate, finalReason || 'Customer rate override');
  };

  const currentEntered = parseFloat(rateInput) || standardPrice;
  const diff = currentEntered - standardPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Customer Rate Override</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pricing Info Box */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Standard Selling Price</p>
            <p className="text-xl font-extrabold text-white font-mono">₹{standardPrice.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 font-medium">Allowed Range</p>
            <p className="text-xs font-semibold text-emerald-400 font-mono">
              ₹{minPrice} - ₹{maxPrice}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleApply} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Enter Actual Selling Rate (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="0.01"
                min={minPrice}
                max={maxPrice}
                autoFocus
                value={rateInput}
                onChange={(e) => handleRateChange(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl text-white font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder={String(standardPrice)}
              />
            </div>
            {diff !== 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                {diff > 0 ? (
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    +₹{diff.toFixed(2)} increase over standard price
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-0.5">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    -₹{Math.abs(diff).toFixed(2)} discount under standard price
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Reason for Rate Override
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-brand-500 rounded-xl text-slate-200 text-sm focus:outline-none"
            >
              {standardReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reason === 'Other' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Specify Custom Reason
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="e.g., Damaged packaging discount"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-600/30 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Apply Customer Rate</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
