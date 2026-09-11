import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isTest = process.env.PLAYWRIGHT_TEST === '1';

export default defineConfig({
  plugins: [react()],
  resolve: isTest
    ? {
        alias: {
          idb: path.resolve(__dirname, 'src/__mocks__/idb.js'),
          '@wllama/wllama': path.resolve(__dirname, 'src/__mocks__/wllama.js'),
        },
      }
    : undefined,
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
  },
});
