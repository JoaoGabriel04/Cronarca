import { defineProject } from 'vitest/config';

// Só funções puras (câmera, conversões). Componentes não são testados aqui.
export default defineProject({
  test: {
    name: 'frontend',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
