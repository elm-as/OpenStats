import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Nettoyage après chaque test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock global de la fonction matchMedia souvent nécessaire pour React/Radix
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // obsolète
    removeListener: vi.fn(), // obsolète
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
