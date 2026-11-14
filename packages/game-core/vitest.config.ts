import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'game-core',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
