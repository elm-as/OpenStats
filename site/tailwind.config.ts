import type { Config } from 'tailwindcss';

/**
 * Palette héritée de l'application OpenStats.
 *
 * Le site et le logiciel doivent se ressembler : un visiteur qui télécharge
 * après avoir vu la vitrine ne doit pas avoir l'impression d'ouvrir un autre
 * produit. Les valeurs sont reprises telles quelles de `frontend/tailwind.config.js`.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0c0f1a',
          50: '#f0f1f5',
          100: '#d8dbe6',
          200: '#b1b7cd',
          300: '#8a93b4',
          400: '#636f9b',
          500: '#3f4b7a',
          600: '#2a3260',
          700: '#1a2044',
          800: '#111630',
          900: '#0c0f1a',
          950: '#070912',
        },
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        secondary: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
