import { CONFIG_AUTH } from '../config.ts';
import type { PrismaClient } from '../db.ts';
import type { User } from '../generated/prisma/client.ts';
import { gerarToken, sha256 } from './tokens.ts';

export interface SessaoValida {
  sessaoId: string;
  usuario: User;
  /** A validade foi estendida: o cookie precisa ser reenviado. */
  renovada: boolean;
  expiraEm: Date;
}

/** Cria a sessão e devolve o token puro (só ele vai no cookie; o banco guarda o hash). */
export async function criarSessao(prisma: PrismaClient, userId: string, agora: Date) {
  const token = gerarToken();
  const expiraEm = new Date(agora.getTime() + CONFIG_AUTH.sessaoDuracaoMs);
  await prisma.session.create({ data: { userId, tokenHash: sha256(token), expiraEm } });
  return { token, expiraEm };
}

export async function validarSessao(
  prisma: PrismaClient,
  token: string,
  agora: Date,
): Promise<SessaoValida | null> {
  const sessao = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!sessao) return null;

  if (sessao.expiraEm.getTime() <= agora.getTime()) {
    await prisma.session.deleteMany({ where: { id: sessao.id } });
    return null;
  }

  // Renovação deslizante, no máximo uma escrita por dia por sessão.
  const novaValidade = agora.getTime() + CONFIG_AUTH.sessaoDuracaoMs;
  if (novaValidade - sessao.expiraEm.getTime() >= CONFIG_AUTH.sessaoRenovarAposMs) {
    const expiraEm = new Date(novaValidade);
    await prisma.session.update({ where: { id: sessao.id }, data: { expiraEm } });
    return { sessaoId: sessao.id, usuario: sessao.user, renovada: true, expiraEm };
  }
  return { sessaoId: sessao.id, usuario: sessao.user, renovada: false, expiraEm: sessao.expiraEm };
}

export async function encerrarSessao(prisma: PrismaClient, sessaoId: string) {
  await prisma.session.deleteMany({ where: { id: sessaoId } });
}
