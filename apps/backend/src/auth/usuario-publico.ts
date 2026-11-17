import type { PrismaClient } from '../db.ts';
import type { User } from '../generated/prisma/client.ts';

/** O que o cliente pode ver do próprio usuário. Nunca inclui o hash da senha. */
export interface UsuarioPublico {
  id: string;
  nome: string;
  /** Nulo em conta de convidado. */
  email: string | null;
  avatarUrl: string | null;
  emailVerificado: boolean;
  temSenha: boolean;
  /** Conta de convidado: sem e-mail e fora do ranking até vincular. */
  convidado: boolean;
  /** Convidado que já ligou Google ou Discord e falta confirmar o nome. */
  vinculoPendente: boolean;
  provedores: ('google' | 'discord')[];
}

export async function usuarioPublico(prisma: PrismaClient, u: User): Promise<UsuarioPublico> {
  const contas = await prisma.oAuthAccount.findMany({
    where: { userId: u.id },
    select: { provedor: true },
    orderBy: { provedor: 'asc' },
  });
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    avatarUrl: u.avatarUrl,
    emailVerificado: u.emailVerificado,
    temSenha: u.senhaHash !== null,
    convidado: u.convidado,
    vinculoPendente: u.convidado && contas.length > 0,
    provedores: contas.map((c) => c.provedor),
  };
}
