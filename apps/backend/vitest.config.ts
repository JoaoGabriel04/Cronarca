import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'backend',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Cria o banco de teste e aplica as migrações antes de tudo.
    globalSetup: ['test/setup/banco-teste.ts'],
    // Os testes de banco compartilham o mesmo banco: um arquivo por vez.
    fileParallelism: false,
  },
});
