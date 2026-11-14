import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token aleatório de 32 bytes, seguro para cookie e URL. */
export function gerarToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

/** Desafio PKCE (S256) a partir do verificador. */
export function desafioPkce(verificador: string): string {
  return createHash('sha256').update(verificador).digest('base64url');
}

/** Compara duas strings sem vazar, pelo tempo, onde elas diferem. */
export function iguaisSemVazar(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
