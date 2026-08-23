import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { BusinessSettings } from '../types/settings';
import { UserProfile } from '../types/auth';
import { logAudit } from './auditService';

const SETTINGS_COLLECTION = 'settings';
const GENERAL_SETTINGS_DOC = 'general';

export const DEFAULT_SETTINGS: BusinessSettings = {
  id: GENERAL_SETTINGS_DOC,
  businessName: 'RARAJU ENTERPRISES',
  legalName: 'Raraju Commercial Enterprises Pvt Ltd',
  tagline: 'Quality Products, Best Prices',
  address: 'Main Commercial Complex, Andhra Pradesh, India',
  phone: '+91 9876543210',
  email: 'support@raraju.com',
  website: 'www.raraju.com',
  gstin: '37AAAAA0000A1Z5',
  currencySymbol: '₹',
  defaultGstRate: 0,
  upiId: 'raraju@upi',
  upiPayeeName: 'RARAJU ENTERPRISES',
  allowNegativeStock: false,
  allowBackorders: false,
  enableCustomerRate: true,
  defaultCustomerRateMaxIncrease: 100,
  requireCustomerRateReason: false,
  allowDiscountInPOS: true,
  maxDiscountPercentage: 20,
  invoicePrefix: 'INV-',
  defaultPrinterType: 'THERMAL_80MM',
  invoiceFooterMessage: 'Thank you for your business! Visit again.',
  invoiceTermsAndConditions: 'Goods once sold cannot be returned after 3 days. Original receipt required.',
  updatedAt: new Date().toISOString()
};

export const getBusinessSettings = async (): Promise<BusinessSettings> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return DEFAULT_SETTINGS;
    }
    return { ...DEFAULT_SETTINGS, ...snap.data() } as BusinessSettings;
  } catch (error) {
    console.error('Error fetching business settings:', error);
    return DEFAULT_SETTINGS;
  }
};

export const saveBusinessSettings = async (
  settings: Partial<BusinessSettings>,
  adminUser: UserProfile
): Promise<BusinessSettings> => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC);
    const current = await getBusinessSettings();
    const updated: BusinessSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString()
    };

    await setDoc(docRef, updated, { merge: true });

    await logAudit(
      adminUser.id,
      adminUser.fullName,
      adminUser.role,
      'SETTINGS_UPDATED',
      'Settings',
      `Updated business & POS settings`,
      { entityId: GENERAL_SETTINGS_DOC, newValue: updated }
    );

    return updated;
  } catch (error) {
    console.error('Error saving business settings:', error);
    throw error;
  }
};
