import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Edit2,
  Power,
  Search,
  Upload,
  Image as ImageIcon,
  Loader2,
  X,
  Check,
  Building2,
  Boxes,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useLanguage } from '../../context/LanguageContext';
import { Product } from '../../types/product';
import { getProducts, createProduct, updateProduct, toggleProductStatus, deleteProduct, subscribeToProducts } from '../../services/productService';
import { uploadProductImage } from '../../services/imageService';

export const Products: React.FC = () => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();
  const { confirm } = useConfirm();
  const { language } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields (Simple & Clean: Image, Name, Packaging 25kg/50kg, Purchase Price, Selling Price)
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('25 kg');
  const [standardPrice, setStandardPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const packagingPresets = ['25 kg', '50 kg', '10 kg', '5 kg', '1 kg', '5 Litre', '1 Litre', 'Box', 'Piece'];

  useEffect(() => {
    const unsubProds = subscribeToProducts((liveProds) => {
      setProducts(liveProds);
      setLoading(false);
    });

    return () => unsubProds();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setSku(`SKU-${Date.now().toString().slice(-5)}`);
    setUnit('25 kg');
    setStandardPrice('');
    setPurchasePrice('');
    setImageUrl('');
    setIsModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setSku(prod.sku);
    setUnit(prod.unit || '25 kg');
    setStandardPrice(String(prod.standardPrice));
    setPurchasePrice(prod.purchasePrice ? String(prod.purchasePrice) : '');
    setImageUrl(prod.imageUrl || '');
    setIsModalOpen(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const res = await uploadProductImage(file);
      setImageUrl(res.url);
      success('Image uploaded successfully.');
    } catch (err: any) {
      error('Failed to upload image: ' + err.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!name.trim()) {
      error('Product name is required.');
      return;
    }
    const priceNum = parseFloat(standardPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      error('Please enter a valid standard selling price.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await updateProduct(
          editingProduct.id,
          {
            name: name.trim(),
            sku: sku.trim() || editingProduct.sku,
            unit,
            standardPrice: priceNum,
            purchasePrice: purchasePrice ? parseFloat(purchasePrice) : priceNum * 0.8,
            imageUrl: imageUrl || undefined
          },
          currentUser
        );
        success('Product updated successfully.');
      } else {
        await createProduct(
          {
            name: name.trim(),
            sku: sku.trim() || `SKU-${Date.now().toString().slice(-5)}`,
            categoryId: 'cat_grains',
            categoryName: 'Grains & Rice',
            unit,
            purchasePrice: purchasePrice ? parseFloat(purchasePrice) : priceNum * 0.8,
            standardPrice: priceNum,
            status: 'ACTIVE',
            imageUrl: imageUrl || undefined
          },
          currentUser
        );
        success('Product created successfully.');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      error('Failed to save product: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (prod: Product) => {
    const confirmed = await confirm({
      title: prod.status === 'ACTIVE' ? 'Deactivate Product' : 'Activate Product',
      message: `Are you sure you want to ${prod.status === 'ACTIVE' ? 'deactivate' : 'activate'} "${prod.name}"?`,
      isDestructive: prod.status === 'ACTIVE'
    });

    if (confirmed && currentUser) {
      try {
        await toggleProductStatus(prod.id, prod.status, currentUser);
        success(`Product ${prod.status === 'ACTIVE' ? 'deactivated' : 'activated'}.`);
      } catch (err: any) {
        error('Failed to toggle status: ' + err.message);
      }
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    const confirmed = await confirm({
      title: 'Delete Product (ఉత్పత్తిని శాశ్వతంగా తొలగించు)',
      message: `Are you sure you want to permanently delete "${prod.name}" (${prod.sku})? This cannot be undone.`,
      confirmText: 'Delete Permanently',
      isDestructive: true
    });

    if (confirmed && currentUser) {
      try {
        await deleteProduct(prod.id, currentUser);
        success(`Product "${prod.name}" permanently deleted.`);
      } catch (err: any) {
        error('Failed to delete product: ' + err.message);
      }
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-indigo-600" />
            <span>Product Master Catalog / ఉత్పత్తుల జాబితా</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Master list of products, packaging specifications, and standard selling prices / ఉత్పత్తులు మరియు ధరల వివరాలు
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product / కొత్త ఉత్పత్తిని చేర్చండి</span>
        </button>
      </div>

      {/* Search Bar & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product name, weight packaging (25 kg)..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>

        <span className="text-xs font-bold text-slate-500">
          Total Products: <strong className="text-slate-900 font-mono">{products.length}</strong>
        </span>
      </div>

      {/* Products Table (Image, Name, Packaging, Purchase Price, Standard Selling Price, Status, Actions) */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs">Loading products catalog...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 p-6">
            <Package className="w-12 h-12 mb-2 text-slate-300 stroke-[1.5]" />
            <p className="text-sm font-bold text-slate-700">No products found</p>
            <p className="text-xs text-slate-400 mt-1">Click "Add New Product" to create your first item</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Product Image</th>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Packaging Unit</th>
                  <th className="py-3.5 px-4 text-right">Purchase Price</th>
                  <th className="py-3.5 px-4 text-right">Selling Price</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                    {/* Thumbnail */}
                    <td className="py-3.5 px-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm">
                        {prod.imageUrl ? (
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </td>

                    {/* Name & SKU */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>
                        <p className="font-extrabold text-sm text-slate-900">{prod.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{prod.sku}</p>
                      </div>
                    </td>

                    {/* Packaging Unit (e.g. 25 kg / 50 kg) */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs">
                        {prod.unit}
                      </span>
                    </td>

                    {/* Purchase Price */}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500 font-bold">
                      {prod.purchasePrice ? `₹${prod.purchasePrice.toFixed(2)}` : '—'}
                    </td>

                    {/* Standard Selling Price */}
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      ₹{prod.standardPrice.toFixed(2)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          prod.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {prod.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(prod)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit Product"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(prod)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            prod.status === 'ACTIVE'
                              ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={prod.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Product (శాశ్వతంగా తొలగించు)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simple Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-scale-up text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    {editingProduct ? 'Edit Product' : 'Add New Product / కొత్త ఉత్పత్తిని చేర్చండి'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add product image, packaging specification, and prices
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* Product Image Upload */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Product Image / ఫోటో
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-300 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {imageUrl ? (
                      <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-1.5 text-xs transition-colors"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{isUploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <p className="text-[10px] text-slate-400">PNG, JPG up to 5MB</p>
                  </div>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Product Name / ఉత్పత్తి పేరు *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rice Bag (Sona Masoori), Sunflower Oil..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              {/* Packaging Unit (25 kg / 50 kg presets) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Weight / Packaging Unit (పరిమాణం) *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {packagingPresets.map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setUnit(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors ${
                        unit === preset
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Or enter custom (e.g. 25 kg, 50 kg)"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Purchase Cost (₹) / కొనుగోలు ధర
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="e.g. 1300"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Standard Selling Price (₹) * / అమ్మకపు ధర
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={standardPrice}
                    onChange={(e) => setStandardPrice(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-black text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Save Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
