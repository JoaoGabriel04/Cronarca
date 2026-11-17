// Vínculo da conta de convidado (Portão B): o MESMO usuário (mesmo id, mesmo estado de jogo) ganha e-mail e senha,
// Google ou Discord. Se o e-mail ou a conta do provedor já são de outro usuário, nada é mesclado: conta_ja_vinculada.
import { carregarEstado } from '@cronarca/game-core';
import type { PrismaClient } from '../db.ts';
import { Prisma, type Provedor, type User } from '../generated/prisma/client.ts';
import { gravarMarco } from '../ranking/repositorio.ts';
import { ErroConta } from './contas.ts';
import type { PerfilOAuth } from './oauth.ts';

type Cliente = PrismaClient | Prisma.TransactionClient;

const chaveUnica = (erro: unknown) => erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';

/**
 * Entrada do ranking de quem acabou de vincular: posição do estado ATUAL do jogo (não do zero), tempo jogado
 * acumulado e marcoEm = agora (o desempate passa a valer "desde quando está nesta posição do ranking").
 * Sem estado ainda, nada a fazer: ele cria a entrada ao nascer, já como conta vinculada.
 */
async function entrarNoRanking(db: Cliente, userId: string, agora: number): Promise<void> {
  const linha = await db.gameState.findUnique({ where: { userId } });
  if (!linha) return;
  await gravarMarco(db, userId, carregarEstado(linha.estado, linha.versaoEsquema), agora);
}

/** E-mail e senha numa etapa só (o nome já vem no formulário). */
export async function vincularPorEmail(
  prisma: PrismaClient,
  userId: string,
  dados: { nome: string; email: string; senhaHash: string },
  agora: Date,
): Promise<User> {
  try {
    return await prisma.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: userId, convidado: true },
        data: { email: dados.email, senhaHash: dados.senhaHash, nome: dados.nome, convidado: false, emailVerificado: false },
      });
      if (count === 0) throw new ErroConta('nao_e_convidado');
      await entrarNoRanking(tx, userId, agora.getTime());
      return tx.user.findUniqueOrThrow({ where: { id: userId } });
    });
  } catch (erro) {
    if (chaveUnica(erro)) throw new ErroConta('conta_ja_vinculada');
    throw erro;
  }
}

/**
 * Etapa 1 do vínculo por Google ou Discord: liga a conta do provedor e o e-mail verificado ao convidado, que
 * continua convidado (vínculo pendente) até confirmar o nome. Só então ele entra no ranking.
 */
export async function anexarOAuth(prisma: PrismaClient, userId: string, provedor: Provedor, perfil: PerfilOAuth): Promise<User> {
  if (!perfil.email || !perfil.emailVerificado) throw new ErroConta('email_nao_verificado');
  const email = perfil.email.trim().toLowerCase();
  try {
    return await prisma.$transaction(async (tx) => {
      const usuario = await tx.user.findUnique({ where: { id: userId } });
      if (!usuario?.convidado) throw new ErroConta('nao_e_convidado');

      const daConta = await tx.oAuthAccount.findUnique({
        where: { provedor_providerAccountId: { provedor, providerAccountId: perfil.providerAccountId } },
      });
      if (daConta && daConta.userId !== userId) throw new ErroConta('conta_ja_vinculada');
      const doEmail = await tx.user.findUnique({ where: { email } });
      if (doEmail && doEmail.id !== userId) throw new ErroConta('conta_ja_vinculada');
      const doProvedor = await tx.oAuthAccount.findUnique({ where: { userId_provedor: { userId, provedor } } });
      if (doProvedor && doProvedor.providerAccountId !== perfil.providerAccountId) throw new ErroConta('conta_ja_vinculada');

      if (!doProvedor) {
        await tx.oAuthAccount.create({ data: { userId, provedor, providerAccountId: perfil.providerAccountId } });
      }
      return tx.user.update({
        where: { id: userId },
        data: { email, emailVerificado: true, ...(usuario.avatarUrl ? {} : { avatarUrl: perfil.avatarUrl }) },
      });
    });
  } catch (erro) {
    if (chaveUnica(erro)) throw new ErroConta('conta_ja_vinculada');
    throw erro;
  }
}

/** Etapa 2: grava o nome escolhido, encerra o estado de convidado e cria a entrada do ranking. */
export async function confirmarVinculo(prisma: PrismaClient, userId: string, nome: string, agora: Date): Promise<User> {
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.user.findUnique({ where: { id: userId }, include: { contasOAuth: { select: { id: true } } } });
    if (!usuario?.convidado) throw new ErroConta('nao_e_convidado');
    if (usuario.contasOAuth.length === 0) throw new ErroConta('vinculo_inexistente');
    await tx.user.update({ where: { id: userId }, data: { nome, convidado: false } });
    await entrarNoRanking(tx, userId, agora.getTime());
    return tx.user.findUniqueOrThrow({ where: { id: userId } });
  });
}
