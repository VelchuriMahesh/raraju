import React, { createContext, useContext, useState, useEffect } from 'react';

export type LanguageMode = 'en' | 'te' | 'dual';

export interface Translations {
  [key: string]: {
    en: string;
    te: string;
  };
}

export const translations: Translations = {
  // Brand & General
  appName: { en: 'RARAJU POS & INVENTORY', te: 'రారాజు పీఓఎస్ & ఇన్వెంటరీ' },
  headquarters: { en: 'Headquarters Control', te: 'ప్రధాన కార్యాలయ నియంత్రణ' },
  assignedBranch: { en: 'Assigned Branch', te: 'కేటాయించిన బ్రాంచ్' },
  signOut: { en: 'Sign Out', te: 'లాగ్ అవుట్' },
  search: { en: 'Search', te: 'శోధించండి' },
  save: { en: 'Save', te: 'సేవ్ చేయండి' },
  cancel: { en: 'Cancel', te: 'రద్దు' },
  status: { en: 'Status', te: 'స్థితి' },
  active: { en: 'ACTIVE', te: 'యాక్టివ్' },
  inactive: { en: 'INACTIVE', te: 'ఇన్యాక్టివ్' },
  actions: { en: 'Actions', te: 'చర్యలు' },
  edit: { en: 'Edit', te: 'సవరించు' },
  enable: { en: 'Enable', te: 'ప్రారంభించు' },
  disable: { en: 'Disable', te: 'నిలిపివేయి' },

  // Navigation Links
  dashboard: { en: 'Dashboard', te: 'డ్యాష్‌బోర్డ్' },
  stores: { en: 'Stores', te: 'స్టోర్లు / బ్రాంచ్‌లు' },
  users: { en: 'Staff Users', te: 'సిబ్బంది / ఉద్యోగులు' },
  products: { en: 'Products', te: 'ఉత్పత్తులు' },
  stockAssignment: { en: 'Daily Stock Assign', te: 'రోజువారీ స్టాక్ కేటాయింపు' },
  categories: { en: 'Categories', te: 'వర్గాలు' },
  inventory: { en: 'Store Inventory & Ledger', te: 'స్టోర్ ఇన్వెంటరీ & స్టాక్ లెడ్జర్' },
  reconciliation: { en: 'Stock Reconciliation', te: 'స్టాక్ సరిచూడటం (రీకాన్సిలేషన్)' },
  purchases: { en: 'Supplier Purchases & Inward Stock', te: 'సప్లయర్ కొనుగోళ్లు & ఇన్వర్డ్ స్టాక్' },
  transfers: { en: 'Stock Transfers', te: 'స్టాక్ బదిలీలు' },
  sales: { en: 'Sales & Invoices', te: 'అమ్మకాలు & ఇన్వాయిస్‌లు' },
  dailyHistory: { en: 'Daily History', te: 'రోజువారీ చరిత్ర' },
  customers: { en: 'Customers', te: 'కస్టమర్లు' },
  expenses: { en: 'Expenses', te: 'ఖర్చులు' },
  closings: { en: 'Daily Closings', te: 'రోజువారీ లెక్క ముగింపు' },
  reports: { en: 'Reports & Profit', te: 'నివేదికలు & లాభనష్టాలు' },
  audit: { en: 'Audit Logs', te: 'ఆడిట్ లాగ్స్' },
  settings: { en: 'Settings', te: 'సెట్టింగులు' },

  // POS & Billing
  newBill: { en: 'New Bill (POS)', te: 'కొత్త బిల్లు (POS)' },
  storeSales: { en: 'Store Sales', te: 'స్టోర్ అమ్మకాలు' },
  dailyClosing: { en: 'Daily Cash Closing', te: 'రోజువారీ నగదు ముగింపు' },
  productCatalog: { en: 'Product Catalog', te: 'ఉత్పత్తుల జాబితా' },
  allProducts: { en: 'All Products', te: 'అన్ని ఉత్పత్తులు' },
  searchPlaceholder: { en: 'Search by Name, SKU, or Scan Barcode...', te: 'పేరు, SKU లేదా బార్‌కోడ్ ద్వారా శోధించండి...' },
  currentCart: { en: 'Current Cart', te: 'ప్రస్తుత కార్ట్' },
  itemsSelected: { en: 'items selected', te: 'వస్తువులు ఎంచుకోబడ్డాయి' },
  cartEmpty: { en: 'Cart is Empty', te: 'కార్ట్ ఖాళీగా ఉంది' },
  clear: { en: 'Clear', te: 'ఖాళీ చేయండి' },
  stock: { en: 'Stock', te: 'స్టాక్' },
  outOfStock: { en: 'OUT OF STOCK', te: 'స్టాక్ అయిపోయింది' },
  lowStock: { en: 'Low Stock', te: 'తక్కువ స్టాక్' },
  standardPrice: { en: 'Selling Price', te: 'అమ్మకపు ధర' },
  customerRate: { en: 'Customer Rate', te: 'కస్టమర్ రేట్' },
  subtotal: { en: 'Subtotal', te: 'ఉప మొత్తం' },
  gst: { en: 'GST Tax', te: 'జీఎస్టీ పన్ను' },
  discount: { en: 'Discount', te: 'డిస్కౌంట్' },
  grandTotal: { en: 'Grand Total', te: 'మొత్తం బిల్లు' },
  completeSale: { en: 'COMPLETE SALE', te: 'సేల్ పూర్తి చేయండి' },
  syncStock: { en: 'Sync Stock', te: 'స్టాక్ రిఫ్రెష్' },

  // Payment
  paymentAndCheckout: { en: 'Payment & Checkout', te: 'చెల్లింపు & చెక్‌అవుట్' },
  selectPaymentMethod: { en: 'Select Payment Method', te: 'చెల్లింపు విధానాన్ని ఎంచుకోండి' },
  cash: { en: 'Cash', te: 'నగదు (Cash)' },
  upi: { en: 'UPI / QR', te: 'యూపీఐ / క్యూఆర్' },
  card: { en: 'Card', te: 'కార్డు (Card)' },
  credit: { en: 'Store Credit', te: 'అరువు / క్రెడిట్' },
  split: { en: 'Split Pay', te: 'స్ప్లిట్ చెల్లింపు' },
  cashTendered: { en: 'Cash Tendered / Received', te: 'స్వీకరించిన నగదు' },
  changeDue: { en: 'Change Due to Customer', te: 'కస్టమర్‌కు ఇవ్వాల్సిన చిల్లర' },
  customerName: { en: 'Customer Name', te: 'కస్టమర్ పేరు' },
  customerPhone: { en: 'WhatsApp Mobile', te: 'వాట్సాప్ మొబైల్' },

  // Post Sale / Invoice
  saleCompleted: { en: 'SALE COMPLETED!', te: 'సేల్ విజయవంతంగా పూర్తయింది!' },
  invoiceNumber: { en: 'Invoice Number', te: 'ఇన్వాయిస్ నంబర్' },
  downloadA4: { en: 'Download A4', te: 'A4 పీడీఎఫ్ డౌన్‌లోడ్' },
  downloadReceipt: { en: '80mm Receipt', te: '80mm రసీదు' },
  printReceipt: { en: 'Print Receipt', te: 'ప్రింట్ చేయండి' },
  whatsAppInvoice: { en: 'WhatsApp Invoice', te: 'వాట్సాప్ ఇన్వాయిస్' },
  startNewBill: { en: 'START NEW BILL', te: 'తదుపరి కొత్త బిల్లు' },

  // Dashboard & Metrics
  executiveCommand: { en: 'Executive Business Command', te: 'ఎగ్జిక్యూటివ్ బిజినెస్ కమాండ్' },
  revenue: { en: 'Revenue', te: 'మొత్తం రాబడి' },
  grossProfit: { en: 'Gross Profit', te: 'స్థూల లాభం (Gross Profit)' },
  netProfit: { en: 'Net Profit', te: 'నికర లాభం (Net Profit)' },
  totalBills: { en: 'Total Bills', te: 'మొత్తం బిల్లులు' },
  itemsSold: { en: 'Items Sold', te: 'అమ్మిన వస్తువులు' },
  storePerformance: { en: 'Store Performance Breakdown', te: 'స్టోర్ల వారీ పనితీరు' },
  quickActions: { en: 'Direct Management Actions', te: 'త్వరిత చర్యలు' },
  stockWatchlist: { en: 'Stock Watchlist', te: 'స్టాక్ హెచ్చరికలు' },
  today: { en: 'Today', te: 'ఈ రోజు' },
  week: { en: 'This Week', te: 'ఈ వారం' },
  month: { en: 'This Month', te: 'ఈ నెల' },
  allTime: { en: 'All Time', te: 'మొత్తం సమయం' },

  // Forms & Tables
  productName: { en: 'Product Name', te: 'ఉత్పత్తి పేరు' },
  category: { en: 'Category', te: 'వర్గం' },
  sku: { en: 'SKU Code', te: 'SKU కోడ్' },
  unit: { en: 'Unit', te: 'పరిమాణం / యూనిట్' },
  purchasePrice: { en: 'Purchase Price', te: 'కొనుగోలు ధర' },
  sellingPrice: { en: 'Selling Price', te: 'అమ్మకపు ధర' },
  supplier: { en: 'Supplier', te: 'సప్లయర్' },
  quantity: { en: 'Quantity', te: 'పరిమాణం' },
  reason: { en: 'Reason', te: 'కారణం' },
  difference: { en: 'Difference', te: 'తేడా' },
  date: { en: 'Date & Time', te: 'తేదీ & సమయం' },
  cashier: { en: 'Cashier', te: 'క్యాషియర్' },
  exportCsv: { en: 'Export CSV', te: 'CSV ఎగుమతి' }
};

interface LanguageContextType {
  language: LanguageMode;
  setLanguage: (lang: LanguageMode) => void;
  t: (key: string, defaultText?: string) => string;
  isTelugu: boolean;
  isDual: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageMode>(() => {
    return (localStorage.getItem('raraju_lang') as LanguageMode) || 'dual';
  });

  const setLanguage = (lang: LanguageMode) => {
    setLanguageState(lang);
    localStorage.setItem('raraju_lang', lang);
  };

  const t = (key: string, defaultText?: string): string => {
    const item = translations[key];
    if (!item) return defaultText || key;

    if (language === 'te') {
      return item.te || item.en || defaultText || key;
    }
    if (language === 'dual') {
      if (item.en === item.te) return item.en;
      return `${item.en} / ${item.te}`;
    }
    return item.en || defaultText || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isTelugu: language === 'te',
        isDual: language === 'dual'
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
