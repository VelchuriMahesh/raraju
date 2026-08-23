import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Barcode, Package, Image as ImageIcon } from 'lucide-react';
import { Product } from '../../types/product';
import { useLanguage } from '../../context/LanguageContext';

interface ProductGridProps {
  products: Product[];
  categories?: any[];
  inventoryMap: { [productId: string]: number };
  onAddToCart: (product: Product) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  inventoryMap,
  onAddToCart
}) => {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      if (!query) return true;

      return (
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.toLowerCase().includes(query)) ||
        (p.unit && p.unit.toLowerCase().includes(query))
      );
    });
  }, [products, searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const match = products.find(
        (p) =>
          p.status === 'ACTIVE' &&
          (p.barcode === searchQuery.trim() || p.sku.toLowerCase() === searchQuery.toLowerCase().trim())
      );
      if (match) {
        onAddToCart(match);
        setSearchQuery('');
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Search Bar */}
      <div className="bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={
              language === 'te'
                ? 'ఉత్పత్తి పేరు లేదా బరువు (25kg, 50kg) శోధించండి... (/ నొక్కండి)'
                : 'Search products by name, weight (25kg, 50kg), SKU... (Press / to search)'
            }
            className="w-full pl-11 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 font-medium"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 text-xs font-mono">
            <Barcode className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {filteredProducts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl p-6 text-center bg-white">
            <Package className="w-12 h-12 mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">
              {language === 'te' ? 'ఉత్పత్తులు ఏవీ కనుగొనబడలేదు' : 'No products found'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const stock = inventoryMap[product.id] ?? 0;
              const isOutOfStock = stock <= 0;
              const isLowStock = stock > 0 && stock <= (product.minStockAlert || 5);

              return (
                <button
                  key={product.id}
                  disabled={isOutOfStock}
                  onClick={() => onAddToCart(product)}
                  className={`group flex flex-col justify-between p-3 rounded-2xl border text-left transition-all relative overflow-hidden bg-white ${
                    isOutOfStock
                      ? 'border-slate-200 opacity-60 cursor-not-allowed bg-slate-50'
                      : 'border-slate-200 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 active:scale-[0.98]'
                  }`}
                >
                  {/* Stock Badge Top Right */}
                  <div className="absolute top-2.5 right-2.5 z-10">
                    {isOutOfStock ? (
                      <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                        {t('outOfStock')}
                      </span>
                    ) : isLowStock ? (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                        {language === 'te' ? `కేవలం ${stock} సంచులు` : `Only ${stock} Bags left`}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                        {t('stock')}: {stock} {stock === 1 ? 'Bag' : 'Bags'}
                      </span>
                    )}
                  </div>

                  {/* Product Image */}
                  <div className="w-full h-32 rounded-xl bg-slate-100 border border-slate-100 overflow-hidden mb-2.5 flex items-center justify-center relative">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <ImageIcon className="w-8 h-8 mb-1 text-slate-300" />
                        <span className="text-[10px] font-bold uppercase">{product.unit || 'Pack'}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5 w-full">
                    <p className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                      {product.name}
                    </p>

                    {/* Weight / Pack Size Badge */}
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700">
                        {product.unit || 'Unit'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {product.sku}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-base font-black text-slate-900 font-mono">
                        ₹{product.standardPrice.toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                        + Add
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
