// Dados de desenvolvimento. Idempotente: rodar de novo não duplica nada.
// Só usuários; o estado de jogo nasce no Portão 4/5 a partir do game-core.
import bcrypt from 'bcrypt';
import { criarPrisma } from '../src/db.ts';
import { carregarEnv } from '../src/env.ts';

const CUSTO_BCRYPT = 12;

const USUARIOS_DEV = [
  { email: 'dev@cronarca.local', nome: 'Dev', senha: 'cronarca' },
] as const;

async function main() {
  const env = carregarEnv();
  if (env.NODE_ENV === 'production') {
    throw new Error('O seed de desenvolvimento não roda em produção.');
  }

  const prisma = criarPrisma(env.DATABASE_URL);
  try {
    for (const u of USUARIOS_DEV) {
      const email = u.email.toLowerCase();
      const senhaHash = await bcrypt.hash(u.senha, CUSTO_BCRYPT);
      await prisma.user.upsert({
        where: { email },
        update: { nome: u.nome, senhaHash },
        create: { email, nome: u.nome, senhaHash },
      });
      console.log(`[seed] usuário ${email} (senha: ${u.senha})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  console.error(erro);
  process.exit(1);
});
