import { defineProject } from 'vitest/config';

// Só funções puras (câmera, conversões). Componentes não são testados aqui.
export default defineProject({
  test: {
    name: 'frontend',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Testes de imagem leem PNGs grandes (mapa, quadros); rodando junto com o resto da suíte, 5 s não bastava.
    testTimeout: 15_000,
  },
});
