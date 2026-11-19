import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // Dev-tooling ports come from the shell first, then frontend/.env (see .env.example). Nothing here is
  // exposed to browser code: only VITE_-prefixed variables ever reach the bundle.
  const fileEnv = loadEnv(mode, __dirname, '');
  const webPort = Number(process.env.WEB_PORT || fileEnv.WEB_PORT) || 5173;
  const apiTarget =
    process.env.API_PROXY_TARGET ||
    fileEnv.API_PROXY_TARGET ||
    `http://localhost:${process.env.API_PORT || fileEnv.API_PORT || 4000}`;
  // Same-origin API in development, mirroring the production reverse-proxy setup (required for SameSite cookies).
  const proxy = { '/api': { target: apiTarget, changeOrigin: false } };

  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: { port: webPort, proxy },
    preview: { port: Number(process.env.PREVIEW_PORT || fileEnv.PREVIEW_PORT) || 4173, proxy },
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
  };
});
