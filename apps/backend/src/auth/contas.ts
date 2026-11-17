import { CONFIG_AUTH } from '../config.ts';
import type { PrismaClient } from '../db.ts';
import type { Provedor, User } from '../generated/prisma/client.ts';
import type { PerfilOAuth } from './oauth.ts';

export class ErroConta extends Error {
  constructor(readonly codigo: 'email_nao_verificado' | 'conta_ja_vinculada' | 'nao_e_convidado' | 'vinculo_inexistente') {
    super(codigo);
  }
}

function nomeDoPerfil(perfil: PerfilOAuth): string {
  const nome = (perfil.nome ?? '').trim().slice(0, CONFIG_AUTH.nomeMax);
  return nome.length >= CONFIG_AUTH.nomeMin ? nome : 'Aventureiro';
}

/**
 * Entra com Google ou Discord. Regras (decisão do Portão 3):
 * 1. Conta do provedor já vinculada: entra nela.
 * 2. Senão, exige e-mail verificado pelo provedor.
 * 3. Existe usuário com esse e-mail: vincula. Se esse usuário tinha senha com
 *    e-mail nunca verificado, a senha é apagada e as sessões dele encerradas,
 *    porque quem provou ser dono do e-mail foi o provedor (impede que alguém
 *    "reserve" o e-mail de outra pessoa).
 * 4. Não existe: cria o usuário já verificado.
 */
export async function entrarComOAuth(
  prisma: PrismaClient,
  provedor: Provedor,
  perfil: PerfilOAuth,
): Promise<User> {
  const vinculada = await prisma.oAuthAccount.findUnique({
    where: { provedor_providerAccountId: { provedor, providerAccountId: perfil.providerAccountId } },
    include: { user: true },
  });
  if (vinculada) return vinculada.user;

  if (!perfil.email || !perfil.emailVerificado) throw new ErroConta('email_nao_verificado');
  const email = perfil.email.trim().toLowerCase();

  return prisma.$transaction(async (tx) => {
    const existente = await tx.user.findUnique({ where: { email } });

    if (!existente) {
      return tx.user.create({
        data: {
          email,
          nome: nomeDoPerfil(perfil),
          emailVerificado: true,
          avatarUrl: perfil.avatarUrl,
          contasOAuth: { create: { provedor, providerAccountId: perfil.providerAccountId } },
        },
      });
    }

    const outraDoMesmoProvedor = await tx.oAuthAccount.findUnique({
      where: { userId_provedor: { userId: existente.id, provedor } },
    });
    if (outraDoMesmoProvedor) throw new ErroConta('conta_ja_vinculada');

    const senhaNaoVerificada = !existente.emailVerificado && existente.senhaHash !== null;
    if (senhaNaoVerificada) {
      await tx.session.deleteMany({ where: { userId: existente.id } });
    }
    await tx.oAuthAccount.create({
      data: { userId: existente.id, provedor, providerAccountId: perfil.providerAccountId },
    });
    return tx.user.update({
      where: { id: existente.id },
      data: {
        emailVerificado: true,
        ...(senhaNaoVerificada ? { senhaHash: null } : {}),
        ...(existente.avatarUrl ? {} : { avatarUrl: perfil.avatarUrl }),
      },
    });
  });
}
