# RARAJU - Multi-Store POS, Billing, Inventory & Business Management System

A production-ready, modern, secure, and scalable **Multi-Store POS + Billing + Inventory Management System** built with React, TypeScript, Tailwind CSS, Firebase (Authentication + Cloud Firestore with atomic transactions & security rules), ImgBB image optimization, Thermal 80mm / A4 invoice printing, jsPDF generator, WhatsApp sharing, and immutable audit logs.

## Features

- **Multi-Store Control**: Create and manage unlimited store branches with branch-specific invoice numbering prefixes (`S1-`, `S2-`).
- **Granular RBAC & Store Isolation**: Admin has central access. Store staff can only bill and view data for their assigned store.
- **Product Master & ImgBB Upload**: Image compression on canvas, standard price, GST %, HSN, and measurement units.
- **Store-Specific Inventory & Ledger**: Strict atomic transactions, zero negative stock, complete stock movement ledger.
- **Admin Stock Reconciliation**: Audit physical stock vs system stock and generate reconciliation adjustments with audit reasons.
- **High-Speed POS Billing**: Fast product search, barcode gun scanner support, live stock limit validation.
- **Customer Rate Overrides**: Admin-controlled bounds (`minAllowedPrice`, `maxAllowedPrice`, `maxIncrease`) with itemized audit tracking.
- **Multi-Payment Modes**: Cash with change calculator, UPI / QR, Card, Store Credit, Split Payments.
- **80mm Thermal & A4 Invoices**: jsPDF document generation and direct thermal print layout.
- **WhatsApp Share Flow**: Formatted invoice sharing via WhatsApp link.
- **Financial Analytics & P&L**: Gross Profit (`Revenue - COGS`) and Net Profit (`Gross Profit - Expenses`).
- **Store Cash Closing**: Shift-end register cash reconciliation.
- **Immutable Audit Trail**: Append-only security log of all business events.

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run in development mode
npm run dev

# 3. Build for production
npm run build
```
