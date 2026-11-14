import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

/** Cria um cliente Prisma ligado ao Postgres pela URL dada. */
export function criarPrisma(urlBanco: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: urlBanco }) });
}

/** Função que o /health usa para saber se o banco responde. */
export type VerificarBanco = () => Promise<boolean>;

export function verificadorDoBanco(prisma: PrismaClient): VerificarBanco {
  return async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  };
}

export type { PrismaClient };
