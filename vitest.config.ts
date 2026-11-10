import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: { FVS_QUIET: '1' },
  },
});
