/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Chemins d'assets relatifs. Electron charge l'interface via loadFile(),
  // donc en file:// : un chemin absolu « /assets/... » y pointe vers la racine
  // du disque et aucun script ne se charge — la fenetre reste blanche sans
  // message d'erreur. Sans effet sur le deploiement web, servi depuis la racine.
  base: './',
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
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          // Normalize Windows path separators for deterministic cross-platform matching
          const normalized = id.replace(/\\/g, '/');

          // 1. Plotly scientific charting (~4.7 MB)
          if (normalized.includes('plotly.js') || normalized.includes('react-plotly')) {
            return 'vendor-plotly';
          }

          // 2. ReactFlow / @xyflow canvas graph engine (~300 kB)
          if (normalized.includes('@xyflow')) {
            return 'vendor-reactflow';
          }

          // 3. Monaco code editor (~1.5 MB)
          if (normalized.includes('@monaco-editor') || normalized.includes('monaco-editor')) {
            return 'vendor-monaco';
          }

          // 4. KaTeX mathematical formula rendering (~250 kB)
          if (normalized.includes('katex') || normalized.includes('react-katex')) {
            return 'vendor-katex';
          }

          // 5. Lucide icons (~38 kB)
          if (normalized.includes('lucide-react')) {
            return 'vendor-icons';
          }

          // 6. Core React & State runtime (~150 kB)
          if (
            normalized.includes('/react/') ||
            normalized.includes('/react-dom/') ||
            normalized.includes('/scheduler/') ||
            normalized.includes('/react-router/') ||
            normalized.includes('/react-router-dom/') ||
            normalized.includes('/@remix-run/router/') ||
            normalized.includes('/@reduxjs/toolkit/') ||
            normalized.includes('/react-redux/')
          ) {
            return 'vendor-react';
          }

          return undefined;
        },
      },
    },
  },
});
