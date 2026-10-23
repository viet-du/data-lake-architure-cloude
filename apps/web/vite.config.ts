import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    proxy: {
      '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
  };
});