import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: Number(process.env.WEB_PORT) || 5173,
    // Same-origin API in development, mirroring the production reverse-proxy setup (required for SameSite cookies).
    proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 4000}`, changeOrigin: false } },
  },
  build: {
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: app deploys don't invalidate cached framework code.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['@tanstack/react-query', 'axios'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
});
