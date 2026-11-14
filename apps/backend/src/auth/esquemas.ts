import { z } from 'zod';
import { CONFIG_AUTH } from '../config.ts';

const email = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .max(254, 'E-mail longo demais.')
  .pipe(z.email('E-mail inválido.'));

const senhaNova = z
  .string({ error: 'Informe a senha.' })
  .min(CONFIG_AUTH.senhaMin, `A senha precisa de pelo menos ${CONFIG_AUTH.senhaMin} caracteres.`)
  .refine((s) => Buffer.byteLength(s, 'utf8') <= CONFIG_AUTH.senhaMaxBytes, {
    error: `A senha pode ter no máximo ${CONFIG_AUTH.senhaMaxBytes} caracteres.`,
  });

export const esquemaCadastro = z.strictObject({
  nome: z
    .string({ error: 'Informe o nome.' })
    .trim()
    .min(CONFIG_AUTH.nomeMin, `O nome precisa de pelo menos ${CONFIG_AUTH.nomeMin} letras.`)
    .max(CONFIG_AUTH.nomeMax, `O nome pode ter no máximo ${CONFIG_AUTH.nomeMax} letras.`),
  email,
  senha: senhaNova,
});

export const esquemaLogin = z.strictObject({
  email,
  senha: z.string({ error: 'Informe a senha.' }).min(1, 'Informe a senha.').max(200),
});

export const esquemaProvedor = z.enum(['google', 'discord']);

export const esquemaCallback = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(256),
});

/** Erros do Zod no formato { campo: mensagem } (primeira mensagem de cada campo). */
export function camposComErro(erro: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of erro.issues) {
    const campo = issue.path.join('.') || '_';
    campos[campo] ??= issue.code === 'unrecognized_keys' ? 'Campo não permitido.' : issue.message;
  }
  return campos;
}
