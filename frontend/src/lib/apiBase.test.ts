import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, buildApiHeaders, resolveApiV1Url } from './apiBase';

describe('apiBase helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    delete (window as any).OPENSTATS_API_URL;
    delete (window as any).OPENSTATS_SESSION_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('résout les chemins relatifs et /api/v1 sans duplication', () => {
    expect(resolveApiV1Url('/canvas/export_code')).toBe('http://localhost:5000/api/v1/canvas/export_code');
    expect(resolveApiV1Url('/api/v1/canvas/export_code')).toBe(
      'http://localhost:5000/api/v1/canvas/export_code'
    );
    expect(resolveApiV1Url('https://example.org/custom')).toBe('https://example.org/custom');
  });

  it('utilise window.OPENSTATS_API_URL en mode Electron', () => {
    (window as any).OPENSTATS_API_URL = 'http://127.0.0.1:43210/';
    expect(resolveApiV1Url('/canvas/share')).toBe('http://127.0.0.1:43210/api/v1/canvas/share');
  });

  it('injecte X-Session-Token et X-Client-Id sans muter les headers reçus', () => {
    (window as any).OPENSTATS_SESSION_TOKEN = 'desktop-secret-token';
    const original = new Headers({ 'Content-Type': 'application/json' });

    const enriched = buildApiHeaders(original);

    expect(enriched.get('Content-Type')).toBe('application/json');
    expect(enriched.get('X-Session-Token')).toBe('desktop-secret-token');
    expect(enriched.get('X-Client-Id')).toMatch(/^[a-z0-9]{8}$/);
    expect(original.has('X-Session-Token')).toBe(false);
    expect(original.has('X-Client-Id')).toBe(false);
  });

  it('apiFetch envoie la requête vers l’URL résolue avec les en-têtes de session', async () => {
    (window as any).OPENSTATS_API_URL = 'http://127.0.0.1:45555';
    sessionStorage.setItem('openstats_session_token', 'session-tok-123');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/canvas/export_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:45555/api/v1/canvas/export_code');
    const sentHeaders = init.headers as Headers;
    expect(sentHeaders.get('X-Session-Token')).toBe('session-tok-123');
    expect(sentHeaders.get('X-Client-Id')).toMatch(/^[a-z0-9]{8}$/);
    expect(sentHeaders.get('Content-Type')).toBe('application/json');
  });
});
