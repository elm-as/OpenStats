/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // Plotly = chunk dédié (4.6 MB, lazy-loaded via viz components)
            if (id.includes('plotly.js') || id.includes('react-plotly')) return 'plotly';
            // React core + router + dom
            if (
              id.includes('/react/') || id.includes('/react-dom/') ||
              id.includes('react-router')
            ) return 'react-vendor';
            // Redux toolkit + RTK Query
            if (
              id.includes('@reduxjs/toolkit') || id.includes('react-redux') ||
              id.includes('redux')
            ) return 'redux-vendor';
            // Icônes (lucide-react ~700 icônes)
            if (id.includes('lucide-react')) return 'icons';
            // Monaco editor (lazy, mais isolé si importé)
            if (id.includes('@monaco-editor')) return 'monaco';
            // Reste des node_modules → vendor chunk
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
});
