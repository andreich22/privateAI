import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./__tests__/setup.js'],
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    include: ['__tests__/**/*.{test,spec}.{js,jsx,ts,tsx,mjs}'],
    exclude: ['node_modules', 'tests'],
  },
});
