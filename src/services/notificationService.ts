import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { AppNotification, NotificationRecipient, NotificationType } from '../types/notification';
import { getLocalData, setLocalData } from './fallbackData';

const NOTIFICATIONS_COLLECTION = 'notifications';

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_welcome',
    recipientRole: 'ALL',
    type: 'SYSTEM_ANNOUNCEMENT',
    title: 'RARAJU POS Online',
    titleTe: 'రారాజు పీఓఎస్ సిద్ధంగా ఉంది',
    message: 'Real-time multi-store business system is active and monitoring.',
    messageTe: 'రియల్ టైమ్ మల్టీ-స్టోర్ బిజినెస్ సిస్టమ్ రన్ అవుతోంది.',
    read: false,
    createdAt: new Date().toISOString()
  }
];

/**
 * Plays a pleasant web audio chime when a real-time notification arrives
 */
export const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Audio autoplay restrictions might catch this if user hasn't interacted yet
  }
};

export const sendNotification = async (
  notifData: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
): Promise<AppNotification> => {
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newNotif: AppNotification = {
    id: notifId,
    ...notifData,
    read: false,
    createdAt: now
  };

  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notifId);
    await setDoc(docRef, newNotif);
  } catch (error) {
    console.warn('Firestore sendNotification notice, saving locally:', error);
  }

  const existing = getLocalData<AppNotification[]>(NOTIFICATIONS_COLLECTION, INITIAL_NOTIFICATIONS);
  const updated = [newNotif, ...existing.slice(0, 49)];
  setLocalData(NOTIFICATIONS_COLLECTION, updated);

  return newNotif;
};

export const subscribeToNotifications = (
  role: 'SUPER_ADMIN' | 'STORE_STAFF',
  storeId: string | undefined,
  callback: (notifications: AppNotification[]) => void
): (() => void) => {
  try {
    let q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
          setLocalData(NOTIFICATIONS_COLLECTION, all);

          const filtered = all.filter((n) => {
            if (role === 'SUPER_ADMIN') {
              return n.recipientRole === 'SUPER_ADMIN' || n.recipientRole === 'ALL';
            } else {
              return (
                n.recipientRole === 'ALL' ||
                (n.recipientRole === 'STORE_STAFF' && (!n.storeId || n.storeId === storeId))
              );
            }
          });

          callback(filtered);
        } else {
          const cached = getLocalData<AppNotification[]>(NOTIFICATIONS_COLLECTION, INITIAL_NOTIFICATIONS);
          const filtered = cached.filter((n) => {
            if (role === 'SUPER_ADMIN') return n.recipientRole === 'SUPER_ADMIN' || n.recipientRole === 'ALL';
            return n.recipientRole === 'ALL' || (n.recipientRole === 'STORE_STAFF' && (!n.storeId || n.storeId === storeId));
          });
          callback(filtered);
        }
      },
      (error) => {
        console.warn('Firestore notifications subscription fallback:', error);
        const cached = getLocalData<AppNotification[]>(NOTIFICATIONS_COLLECTION, INITIAL_NOTIFICATIONS);
        const filtered = cached.filter((n) => {
          if (role === 'SUPER_ADMIN') return n.recipientRole === 'SUPER_ADMIN' || n.recipientRole === 'ALL';
          return n.recipientRole === 'ALL' || (n.recipientRole === 'STORE_STAFF' && (!n.storeId || n.storeId === storeId));
        });
        callback(filtered);
      }
    );
  } catch (e) {
    const cached = getLocalData<AppNotification[]>(NOTIFICATIONS_COLLECTION, INITIAL_NOTIFICATIONS);
    callback(cached);
    return () => {};
  }
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await updateDoc(docRef, { read: true });
  } catch (e) {}

  const cached = getLocalData<AppNotification[]>(NOTIFICATIONS_COLLECTION, INITIAL_NOTIFICATIONS);
  const updated = cached.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
  setLocalData(NOTIFICATIONS_COLLECTION, updated);
};

export const markAllNotificationsAsRead = async (
  role: 'SUPER_ADMIN' | 'STORE_STAFF',
  storeId?: string
): Promise<void> => {
  const cached = getLocalData<AppNotification[]>(NOTIFICATIONS_COLLECTION, INITIAL_NOTIFICATIONS);
  const updated = cached.map((n) => {
    const isTarget =
      role === 'SUPER_ADMIN'
        ? n.recipientRole === 'SUPER_ADMIN' || n.recipientRole === 'ALL'
        : n.recipientRole === 'ALL' || (n.recipientRole === 'STORE_STAFF' && (!n.storeId || n.storeId === storeId));
    return isTarget ? { ...n, read: true } : n;
  });
  setLocalData(NOTIFICATIONS_COLLECTION, updated);

  try {
    const q = query(collection(db, NOTIFICATIONS_COLLECTION), limit(30));
    const snap = await getDocs(q);
    snap.docs.forEach(async (d) => {
      try {
        await updateDoc(d.ref, { read: true });
      } catch (err) {}
    });
  } catch (e) {}
};

export const clearAllNotifications = async (): Promise<void> => {
  setLocalData(NOTIFICATIONS_COLLECTION, []);
  try {
    const snap = await getDocs(collection(db, NOTIFICATIONS_COLLECTION));
    snap.docs.forEach(async (d) => {
      try {
        await deleteDoc(d.ref);
      } catch (err) {}
    });
  } catch (e) {}
};
