export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_STATUS_CHANGED'
  | 'STORE_CREATED'
  | 'STORE_UPDATED'
  | 'STORE_STATUS_CHANGED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'PRODUCT_STATUS_CHANGED'
  | 'CATEGORY_CREATED'
  | 'STOCK_ADDED'
  | 'STOCK_ADJUSTED'
  | 'STOCK_TRANSFERRED'
  | 'STOCK_RECONCILED'
  | 'PRICE_CHANGED'
  | 'CUSTOMER_RATE_USED'
  | 'SALE_CREATED'
  | 'SALE_CANCELLED'
  | 'SALE_DELETED'
  | 'SALE_RETURNED'
  | 'PURCHASE_CREATED'
  | 'EXPENSE_RECORDED'
  | 'DAILY_CLOSING_SUBMITTED'
  | 'SETTINGS_UPDATED';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  storeId?: string;
  storeName?: string;
  action: AuditAction;
  entity: string; // e.g. "Product", "Sale", "Inventory", "Store"
  entityId?: string;
  details: string;
  oldValue?: any;
  newValue?: any;
  timestamp: string;
}
