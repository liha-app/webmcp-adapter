import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The integration tests mount the real demo app components, which are TSX.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
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
