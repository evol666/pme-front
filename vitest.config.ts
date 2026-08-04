/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // matchMedia / ResizeObserver / IntersectionObserver mocks shared across all Athanor fronts.
    setupFiles: ['@athanor/test-utils/setup'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,jsx,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Sans `all` + `include`, v8 ne rapporte que les fichiers importés par un
      // test : le pourcentage est flatteur mais ne reflète pas ce que Sonar
      // analyse.
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        'e2e/**',
      ],
      // Seuils calés juste sous la couverture atteinte : toute régression
      // notable fait échouer le job de couverture.
      thresholds: {
        lines: 41,
        functions: 39,
        branches: 29,
        statements: 39,
      },
    },
  },
});
