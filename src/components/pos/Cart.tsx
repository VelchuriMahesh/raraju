import React, { useState } from 'react';
import {
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShoppingCart,
  PlusCircle,
  IndianRupee,
  Lock
} from 'lucide-react';
import { Product } from '../../types/product';
import { ExtraAmountModal } from './ExtraAmountModal';
import { useLanguage } from '../../context/LanguageContext';

export interface CartItem {
  product: Product;
  quantity: number;
  actualPrice: number;
  customerRateApplied: boolean;
  customerRateReason?: string;
  discount: number;
}

interface CartProps {
  items: CartItem[];
  inventoryMap: { [productId: string]: number };
  extraAmount: number;
  extraAmountReason: string;
  onUpdateExtraAmount: (amount: number, reason: string) => void;
  onUpdateQuantity: (productId: string, newQty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onOpenCheckout: () => void;
}

export const Cart: React.FC<CartProps> = ({
  items,
  inventoryMap,
  extraAmount,
  extraAmountReason,
  onUpdateExtraAmount,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOpenCheckout
}) => {
  const { t, language } = useLanguage();
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);

  let subtotal = 0;
  for (const it of items) {
    subtotal += it.actualPrice * it.quantity;
  }

  const grandTotal = Math.round((subtotal + extraAmount) * 100) / 100;
  const totalItemCount = items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl flex flex-col h-full overflow-hidden shadow-xl">
      {/* Cart Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold shadow-sm flex-shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-slate-900">{t('currentCart')}</h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {totalItemCount} {t('itemsSelected')}
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-xs text-rose-600 hover:text-rose-700 font-bold px-3 py-1.5 rounded-xl hover:bg-rose-50 transition-colors"
          >
            {t('clear')}
          </button>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <ShoppingCart className="w-14 h-14 mb-2 text-slate-300 stroke-[1.5]" />
            <p className="text-sm font-bold text-slate-600">{t('cartEmpty')}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              {language === 'te'
                ? 'వస్తువులను ఎంచుకోండి లేదా బార్‌కోడ్ స్కాన్ చేయండి'
                : 'Select products from the list to start billing'}
            </p>
          </div>
        ) : (
          items.map((item) => {
            const availableStock = inventoryMap[item.product.id] ?? 0;
            const itemTotal = item.actualPrice * item.quantity;

            return (
              <div
                key={item.product.id}
                className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5 relative group hover:border-indigo-200 hover:bg-white hover:shadow-md transition-all"
              >
                {/* Top Row: Name, Weight Unit, Locked Price, Remove */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {item.product.name}
                      </p>
                      {item.product.unit && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 whitespace-nowrap">
                          {item.product.unit}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-1">
                      <span className="flex items-center gap-0.5 font-bold text-slate-700">
                        <Lock className="w-3 h-3 text-slate-400" />
                        ₹{item.actualPrice.toFixed(2)}
                      </span>
                      <span>•</span>
                      <span>{t('stock')}: {availableStock} {availableStock === 1 ? 'Bag' : 'Bags'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveItem(item.product.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Bottom Row: Quantity Stepper & Item Total */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors font-bold"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono font-black text-xs text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => {
                        if (item.quantity < availableStock) {
                          onUpdateQuantity(item.product.id, item.quantity + 1);
                        }
                      }}
                      disabled={item.quantity >= availableStock}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 flex items-center justify-center transition-colors font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Item Total */}
                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-slate-900">
                      ₹{itemTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart Summary & Extra Amount Section */}
      {items.length > 0 && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          
          {/* Extra Amount Button / Highlight */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold text-xs">
                <IndianRupee className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {language === 'te' ? 'అదనపు మొత్తం (Extra Amount)' : 'Extra Amount / Charges'}
                </p>
                {extraAmount > 0 ? (
                  <p className="text-[10px] text-amber-600 font-semibold truncate max-w-[150px]">
                    {extraAmountReason || 'Extra fee added'}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400">Loading, bag or delivery charge</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsExtraModalOpen(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                extraAmount > 0
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>
                {extraAmount > 0
                  ? `+₹${extraAmount.toFixed(2)}`
                  : language === 'te'
                  ? 'అదనపు మొత్తం జోడించు'
                  : 'Enter Extra Amount'}
              </span>
            </button>
          </div>

          {/* Breakdown */}
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>{t('subtotal')}:</span>
              <span className="text-slate-900 font-mono font-bold">₹{subtotal.toFixed(2)}</span>
            </div>
            
            {extraAmount > 0 && (
              <div className="flex justify-between text-amber-700 font-semibold">
                <span>Extra Fee ({extraAmountReason || 'Additional'}):</span>
                <span className="font-mono">+₹{extraAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>{t('grandTotal')}:</span>
              <span className="text-2xl font-mono text-emerald-600 font-black">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            onClick={onOpenCheckout}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.99]"
          >
            <span>{t('completeSale')} (₹{grandTotal.toFixed(2)})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Extra Amount Modal */}
      {isExtraModalOpen && (
        <ExtraAmountModal
          currentExtraAmount={extraAmount}
          currentReason={extraAmountReason}
          onApply={(amt, rsn) => {
            onUpdateExtraAmount(amt, rsn);
            setIsExtraModalOpen(false);
          }}
          onClose={() => setIsExtraModalOpen(false)}
        />
      )}
    </div>
  );
};
