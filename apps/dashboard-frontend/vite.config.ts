import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/v1': {
        target: process.env.VITE_API_URL || 'http://54.82.212.132:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, '')
      },
      '/graphql': {
        target: process.env.VITE_API_URL || 'http://54.82.212.132:3000',
        changeOrigin: true,
        ws: true,
      },
      '/ingest': {
        target: process.env.VITE_API_URL || 'http://54.82.212.132:3000',
        changeOrigin: true,
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
