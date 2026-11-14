import { criarPrisma } from '../../src/db.ts';
import { urlBancoTeste } from '../setup/banco-teste.ts';

export const prisma = criarPrisma(urlBancoTeste());

/** Esvazia todas as tabelas do banco de teste. */
export async function limparBanco() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE users, oauth_accounts, sessions, game_states, action_logs, ranking_entries CASCADE',
  );
}

let contador = 0;
export function criarUsuario(dados: { email?: string; nome?: string } = {}) {
  contador += 1;
  return prisma.user.create({
    data: {
      email: dados.email ?? `jogador${contador}@teste.local`,
      nome: dados.nome ?? `Jogador ${contador}`,
    },
  });
}
