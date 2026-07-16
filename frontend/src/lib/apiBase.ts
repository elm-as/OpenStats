/**
 * Normalise l'URL de l'API pour éviter les erreurs en production (ex: valeur sans "https://").
 * - Si VITE_API_URL est vide: on reste en relatif (utile avec le proxy Vite en local).
 * - Si VITE_API_URL n'a pas de schéma: on suppose https.
 */
export function getApiOrigin(): string {
  const raw = (import.meta.env.VITE_API_URL || '').trim();
  if (!raw) {
    if (import.meta.env.DEV) return 'http://localhost:5000';
    return '';
  }
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
  return `https://${raw}`.replace(/\/+$/, '');
}

export const API_V1_BASE = `${getApiOrigin()}/api/v1`;

/**
 * Identifiant anonyme (par navigateur) pour isoler les données sans authentification.
 * Doit rester stable (localStorage) et court (8 caractères) car certains IDs en DB sont VARCHAR(8).
 */
export function getAnonymousClientId(): string {
  const key = 'openstats_anon_id';
  const existing = localStorage.getItem(key);
  if (existing && /^[a-z0-9]{8}$/i.test(existing)) return existing.toLowerCase();
  // 8 chars base36
  const id = Math.random().toString(36).slice(2, 10).padEnd(8, '0').slice(0, 8).toLowerCase();
  localStorage.setItem(key, id);
  return id;
}
