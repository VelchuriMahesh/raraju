import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { AuditAction, AuditLog } from '../types/auditLog';
import { getLocalData, setLocalData } from './fallbackData';

const AUDIT_COLLECTION = 'auditLogs';

export const logAudit = async (
  userId: string,
  userName: string,
  userRole: string,
  action: AuditAction,
  entity: string,
  details: string,
  options?: {
    storeId?: string;
    storeName?: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
  }
): Promise<void> => {
  const logData: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    userName,
    userRole,
    action,
    entity,
    details,
    storeId: options?.storeId || '',
    storeName: options?.storeName || '',
    entityId: options?.entityId || '',
    oldValue: options?.oldValue || null,
    newValue: options?.newValue || null,
    timestamp: new Date().toISOString()
  };

  try {
    const docRef = await addDoc(collection(db, AUDIT_COLLECTION), logData);
    logData.id = docRef.id;
  } catch (error) {
    console.warn('Failed to write audit log to Firestore, logging locally:', error);
  }

  const logs = getLocalData<AuditLog[]>(AUDIT_COLLECTION, []);
  setLocalData(AUDIT_COLLECTION, [logData, ...logs.slice(0, 199)]);
};

export const getAuditLogs = async (maxLimit = 200): Promise<AuditLog[]> => {
  try {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(maxLimit)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
      setLocalData(AUDIT_COLLECTION, logs);
      return logs;
    }
  } catch (err) {
    console.warn('Firestore getAuditLogs notice, using local cache:', err);
  }
  return getLocalData<AuditLog[]>(AUDIT_COLLECTION, []);
};
