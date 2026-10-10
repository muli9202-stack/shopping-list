import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['chavruta/tests/unit/**/*.test.ts'], environment: 'node' },
});
