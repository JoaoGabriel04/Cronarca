// Só desenvolvimento: faz o Mercador Viajante chegar agora na conta de dev,
// para conferir a negociação na tela (`make evento-mercador`). Não é rota
// HTTP: nada disso fica exposto a jogadores.
//
// Liquida o estado até agora antes (o tempo parado pode sortear outro
// Mercador e sobrescrever este), abre o Mercador com os termos atuais e
// grava com o rev + 1, para o jogo aberto pegar na próxima leitura.
import { abrirMercador, liquidar, VERSAO_ESQUEMA } from '@cronarca/game-core';
import { criarPrisma } from '../src/db.ts';
import { carregarEnv } from '../src/env.ts';
import { obterOuCriarEstado } from '../src/jogo/repositorio.ts';
import type { Prisma } from '../src/generated/prisma/client.ts';

const EMAIL_DEV = 'dev@cronarca.local';

async function main() {
  const env = carregarEnv();
  if (env.NODE_ENV === 'production') throw new Error('evento-mercador é só para desenvolvimento.');

  const prisma = criarPrisma(env.DATABASE_URL);
  try {
    const usuario = await prisma.user.findUnique({ where: { email: EMAIL_DEV } });
    if (!usuario) throw new Error(`Conta ${EMAIL_DEV} não existe: rode \`make seed\`.`);
    const agora = Date.now();
    const sortear = () => Math.floor(Math.random() * 0x1_0000_0000);
    const { estado, rev } = await obterOuCriarEstado(prisma, usuario.id, agora, sortear);
    const novo = liquidar(estado, Math.max(agora, estado.t));
    abrirMercador(novo, novo.t);
    const { count } = await prisma.gameState.updateMany({
      where: { userId: usuario.id, rev },
      data: { rev: rev + 1, estado: novo as unknown as Prisma.InputJsonValue, atualizadoEm: new Date(novo.t), versaoEsquema: VERSAO_ESQUEMA },
    });
    if (count === 0) throw new Error('O estado mudou durante o script; rode de novo.');
    const m = novo.mercador!;
    console.log(`[evento-mercador] Mercador na conta ${EMAIL_DEV} até ${new Date(m.expiraEm).toLocaleTimeString('pt-BR')} (rev ${rev + 1}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  console.error(erro);
  process.exit(1);
});
