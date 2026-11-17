import type { ConfigCloudinary } from './avatar/cloudinary.ts';
import type { ProvedoresOAuth } from './auth/oauth.ts';
import type { PrismaClient, VerificarBanco } from './db.ts';
import type { User } from './generated/prisma/client.ts';

/** Tudo o que as rotas precisam, injetado (os testes trocam relógio e provedores). */
export interface ContextoApp {
  prisma: PrismaClient;
  verificarBanco: VerificarBanco;
  /** Origem pública do site, ex.: http://localhost:3000. */
  appUrl: string;
  producao: boolean;
  provedores: ProvedoresOAuth;
  cloudinary: ConfigCloudinary | null;
  bcryptCusto: number;
  /** Liga o teto de convidados novos por IP (LIMITE_CONVIDADO_IP). Ausente = desligado. */
  limiteConvidadoIp?: boolean;
  agora: () => Date;
  /** Semente (uint32) do gerador de sorteios de um estado novo. */
  sortearSemente: () => number;
}

declare global {
  namespace Express {
    interface Locals {
      usuario?: User;
      sessaoId?: string;
    }
  }
}
