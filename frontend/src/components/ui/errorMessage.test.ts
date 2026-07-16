import { describe, it, expect } from 'vitest';
import { extractErrorMessage } from './errorMessage';

describe('extractErrorMessage', () => {
  it('returns fallback for null/undefined', () => {
    expect(extractErrorMessage(null)).toBe('Une erreur est survenue');
    expect(extractErrorMessage(undefined)).toBe('Une erreur est survenue');
    expect(extractErrorMessage(null, 'oops')).toBe('oops');
  });

  it('returns the string itself when given a string', () => {
    expect(extractErrorMessage('boom')).toBe('boom');
  });

  it('reads RTKQ-style data.detail', () => {
    expect(extractErrorMessage({ data: { detail: 'token expired' } })).toBe('token expired');
  });

  it('reads data.message and data.error in priority order', () => {
    expect(extractErrorMessage({ data: { message: 'mid' } })).toBe('mid');
    expect(extractErrorMessage({ data: { error: 'low' } })).toBe('low');
    expect(
      extractErrorMessage({ data: { detail: 'top', message: 'mid', error: 'low' } }),
    ).toBe('top');
  });

  it('falls back to .message then .error', () => {
    expect(extractErrorMessage(new Error('plain'))).toBe('plain');
    expect(extractErrorMessage({ error: 'just error' })).toBe('just error');
  });

  it('formats plain status', () => {
    expect(extractErrorMessage({ status: 500 })).toBe('Erreur 500');
    expect(extractErrorMessage({ status: 'FETCH_ERROR' })).toBe('Erreur FETCH_ERROR');
  });
});
