import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'lib/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}',
        'store/**/*.{ts,tsx}',
      ],
      exclude: ['**/*.d.ts', 'tests/**', 'dsg-plugins/**', 'app/**'],
      thresholds: {
        // Phase-1 targets (raised from 50/50/40/50).
        // Phase-2 target: 75/80/70/75. Phase-3: 85/85/80/85.
        // hooks/** and store/** added to include – previously uncovered
        // system surfaces flagged in CCVS compliance gap analysis.
        lines: 60,
        functions: 65,
        branches: 55,
        statements: 60,
      },
    },
  },
});
