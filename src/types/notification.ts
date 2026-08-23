export type NotificationType =
  | 'SALE_COMPLETED'
  | 'DAILY_CLOSING'
  | 'STOCK_UPDATE'
  | 'LOW_STOCK'
  | 'SYSTEM_ANNOUNCEMENT';

export type NotificationRecipient = 'SUPER_ADMIN' | 'STORE_STAFF' | 'ALL';

export interface AppNotification {
  id: string;
  recipientRole: NotificationRecipient;
  storeId?: string;
  storeName?: string;
  type: NotificationType;
  title: string;
  titleTe?: string;
  message: string;
  messageTe?: string;
  amount?: number;
  paymentMethod?: string;
  invoiceNumber?: string;
  read: boolean;
  createdAt: string;
}
