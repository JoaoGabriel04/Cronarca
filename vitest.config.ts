import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/game-core', 'apps/backend', 'apps/frontend'],
  },
});
