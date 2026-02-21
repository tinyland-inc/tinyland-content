import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'tinyland-content',
    globals: true,
    environment: 'node',
  },
});
