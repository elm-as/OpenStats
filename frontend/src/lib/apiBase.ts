/**
 * Normalise l'URL de l'API pour éviter les erreurs en production (ex: valeur sans "https://").
 * - Si VITE_API_URL est vide: on reste en relatif (utile avec le proxy Vite en local).
 * - Si VITE_API_URL n'a pas de schéma: on suppose https.
 */
export function getApiOrigin(): string {
  if (typeof window !== 'undefined' && (window as any).OPENSTATS_API_URL) {
    return ((window as any).OPENSTATS_API_URL as string).replace(/\/+$/, '');
  }
  const raw = (import.meta.env.VITE_API_URL || '').trim();
  if (!raw) {
    if (import.meta.env.DEV) {
      const host = typeof window !== 'undefined' ? window.location?.hostname : '';
      return host === '127.0.0.1' ? 'http://127.0.0.1:5000' : 'http://localhost:5000';
    }
    return '';
  }
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
  return `https://${raw}`.replace(/\/+$/, '');
}

/**
 * Retourne la base d'URL `/api/v1` pour toutes les requêtes backend (desktop Electron ou web).
 */
export function getApiV1Base(): string {
  return `${getApiOrigin()}/api/v1`;
}

export const API_V1_BASE = getApiV1Base();

/**
 * Jeton de session éphémère pour authentifier les requêtes locales vers le backend (anti-CSRF).
 */
export function getSessionToken(): string {
  if (typeof window !== 'undefined') {
    if ((window as any).OPENSTATS_SESSION_TOKEN) {
      return (window as any).OPENSTATS_SESSION_TOKEN as string;
    }
    const stored = sessionStorage.getItem('openstats_session_token');
    if (stored) return stored;
  }
  return (import.meta.env.VITE_SESSION_TOKEN as string) || '';
}

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

/**
 * Résout un chemin d'endpoint relatif vers l'URL complète de l'API v1.
 * Accepte une URL absolue, un chemin `/api/v1/...`, ou un chemin relatif `/...`.
 */
export function resolveApiV1Url(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiV1Base();
  if (path === '/api/v1' || path === '/api/v1/') return base;
  if (path.startsWith('/api/v1/')) return `${base}${path.slice('/api/v1'.length)}`;
  if (path.startsWith('/')) return `${base}${path}`;
  return `${base}/${path}`;
}

/**
 * Construit une nouvelle instance `Headers` enrichie avec `X-Session-Token` et `X-Client-Id`
 * sans muter l'argument fourni.
 */
export function buildApiHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = getSessionToken();
  if (token && !headers.has('X-Session-Token')) {
    headers.set('X-Session-Token', token);
  }
  if (!headers.has('X-Client-Id')) {
    try {
      headers.set('X-Client-Id', getAnonymousClientId());
    } catch {
      // Ignorer si localStorage est indisponible (SSR / environnement restreint)
    }
  }
  return headers;
}

/**
 * Wrapper `fetch` centralisé pour tout appel HTTP hors RTK Query :
 * garantit la résolution d'URL en mode Electron (`file://`) et l'authentification locale.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(resolveApiV1Url(path), {
    ...init,
    headers: buildApiHeaders(init.headers),
  });
}
