/**
 * Single source of truth for which accounts get head-office (SUPER_ADMIN) access.
 *
 * Keep this list in sync with the `isAdmin()` helper in firestore.rules.
 *
 * Historically the check was a substring match (`email.includes('admin')` /
 * `email.includes('raraju')`), which silently promoted ordinary cashiers whose address
 * contained either word. Membership is now exact; anyone else who needs admin access
 * must have `role: 'SUPER_ADMIN'` on their Firestore user document.
 */
export const ADMIN_EMAILS = ['raraju@gmail.com', 'admin@raraju.com'];

export const isAdminEmail = (email?: string | null): boolean =>
  !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
