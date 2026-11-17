// Limpeza de contas de convidado abandonadas (Portão B). Remove só convidado = true, sem senha e sem nenhuma
// conta OAuth (vinculado ou com vínculo pendente nunca é removido), sem atividade há CONFIG_CONVIDADO.inatividadeMs.
// A cascata do esquema apaga sessões, estado do jogo, log de ações, ranking e contas OAuth.
import { CONFIG_CONVIDADO } from '../config.ts';
import type { PrismaClient } from '../db.ts';
import { Prisma } from '../generated/prisma/client.ts';

/** Última atividade = GameState.ultimaAtividadeEm; sem ela (nula ou sem estado), vale o criadoEm. */
function abandonados(corte: Date): Prisma.UserWhereInput {
  return {
    convidado: true,
    senhaHash: null,
    contasOAuth: { none: {} },
    OR: [
      { estadoJogo: { is: { ultimaAtividadeEm: { lt: corte } } } },
      { estadoJogo: { is: { ultimaAtividadeEm: null } }, criadoEm: { lt: corte } },
      { estadoJogo: { is: null }, criadoEm: { lt: corte } },
    ],
  };
}

export async function limparConvidados(prisma: PrismaClient, agora: Date): Promise<{ removidos: number; teto: number }> {
  const corte = new Date(agora.getTime() - CONFIG_CONVIDADO.inatividadeMs);
  const candidatos = await prisma.user.findMany({
    where: abandonados(corte),
    orderBy: { criadoEm: 'asc' },
    take: CONFIG_CONVIDADO.limpezaTeto,
    select: { id: true },
  });
  if (candidatos.length === 0) return { removidos: 0, teto: CONFIG_CONVIDADO.limpezaTeto };
  // As mesmas condições de novo: quem voltou a jogar ou vinculou entre a lista e a remoção fica.
  const { count } = await prisma.user.deleteMany({
    where: { AND: [{ id: { in: candidatos.map((c) => c.id) } }, abandonados(corte)] },
  });
  return { removidos: count, teto: CONFIG_CONVIDADO.limpezaTeto };
}

/** Executa e registra a contagem; nunca derruba o servidor. */
export async function executarLimpeza(prisma: PrismaClient, agora: Date, registrar: (m: string) => void = console.log): Promise<void> {
  try {
    const { removidos, teto } = await limparConvidados(prisma, agora);
    registrar(`[limpeza] convidados removidos: ${removidos} (teto ${teto})`);
    if (removidos >= teto) registrar('[limpeza] teto atingido; o resto fica para a próxima execução');
  } catch (erro) {
    console.error('[limpeza] falhou', erro);
  }
}

/** Uma vez agora (o plano gratuito do Render dorme) e a cada intervalo. Devolve a função que para o agendamento. */
export function agendarLimpeza(prisma: PrismaClient, agora: () => Date, registrar?: (m: string) => void): () => void {
  void executarLimpeza(prisma, agora(), registrar);
  const timer = setInterval(() => void executarLimpeza(prisma, agora(), registrar), CONFIG_CONVIDADO.limpezaIntervaloMs);
  timer.unref();
  return () => clearInterval(timer);
}
