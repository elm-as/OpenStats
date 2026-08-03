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
            // Icônes (lucide-react ~700 icônes)
            if (id.includes('lucide-react')) return 'icons';
            // Monaco editor (lazy)
            if (id.includes('@monaco-editor')) return 'monaco';
          }
          return undefined;
        },
      },
    },
  },
});
