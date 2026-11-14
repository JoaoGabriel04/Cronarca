import { z } from 'zod';

/** Variável opcional: string vazia no .env conta como ausente. */
const opcional = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional());

const esquemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL precisa ser uma URL postgres://'),
  /** Origem pública do site (o Next). Usada no CSRF e nas URLs de retorno do OAuth. */
  APP_URL: z.url().default('http://localhost:3000').transform((u) => new URL(u).origin),
  GOOGLE_CLIENT_ID: opcional,
  GOOGLE_CLIENT_SECRET: opcional,
  DISCORD_CLIENT_ID: opcional,
  DISCORD_CLIENT_SECRET: opcional,
  CLOUDINARY_CLOUD_NAME: opcional,
  CLOUDINARY_API_KEY: opcional,
  CLOUDINARY_API_SECRET: opcional,
});

export type Env = z.infer<typeof esquemaEnv>;

/** Lê e valida as variáveis de ambiente. Falha ao iniciar se algo estiver errado. */
export function carregarEnv(fonte: NodeJS.ProcessEnv = process.env): Env {
  const resultado = esquemaEnv.safeParse(fonte);
  if (!resultado.success) {
    const detalhes = resultado.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${detalhes}`);
  }
  return resultado.data;
}
