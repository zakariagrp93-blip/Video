import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 1_800_000,
    hookTimeout: 600_000,
    fileParallelism: false,
    env: { FVS_QUIET: '1' },
  },
});
