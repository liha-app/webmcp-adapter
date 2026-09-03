import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The integration tests mount the real demo app components, which are TSX.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    // jsdom has no layout; the shim keeps its "Not implemented" notices out of
    // the run without changing what the apps do.
    setupFiles: ['tools/test/jsdom.ts'],
    include: [
      'packages/**/src/**/*.test.ts',
      'apps/**/src/**/*.test.ts',
      'adapters/**/*.test.ts',
      'tests/**/src/**/*.test.{ts,tsx}',
      'tools/**/*.test.ts',
    ],
    restoreMocks: true,
  },
});
