// Conta de convidado (Portão B): usuário sem e-mail e sem senha, com sessão por cookie.
import { randomInt } from 'node:crypto';
import { CONFIG_CONVIDADO } from '../config.ts';
import type { PrismaClient } from '../db.ts';
import type { User } from '../generated/prisma/client.ts';

export class ErroConvidado extends Error {
  constructor(readonly codigo: 'convidados_esgotados', readonly esperarS: number) {
    super(codigo);
  }
}

/** "Convidado" e 4 dígitos. Não identifica ninguém: quem identifica é o id. */
export function nomeDeConvidado(): string {
  return `${CONFIG_CONVIDADO.nomePrefixo} ${randomInt(1000, 10000)}`;
}

/**
 * Cria o convidado se o teto total da janela permitir. A contagem vem do banco (a memória some no reinício);
 * duas requisições simultâneas podem passar do teto por poucas unidades.
 */
export async function criarConvidado(prisma: PrismaClient, agora: Date): Promise<User> {
  const desde = new Date(agora.getTime() - CONFIG_CONVIDADO.janelaMs);
  const recentes = await prisma.user.count({ where: { convidado: true, criadoEm: { gt: desde } } });
  if (recentes >= CONFIG_CONVIDADO.totalPorJanela) {
    const maisAntigo = await prisma.user.findFirst({
      where: { convidado: true, criadoEm: { gt: desde } },
      orderBy: { criadoEm: 'asc' },
      select: { criadoEm: true },
    });
    const reabreEm = (maisAntigo?.criadoEm.getTime() ?? agora.getTime()) + CONFIG_CONVIDADO.janelaMs;
    throw new ErroConvidado('convidados_esgotados', Math.max(1, Math.ceil((reabreEm - agora.getTime()) / 1000)));
  }
  return prisma.user.create({ data: { nome: nomeDeConvidado(), convidado: true } });
}
