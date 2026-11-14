import bcrypt from 'bcrypt';

export function gerarHashSenha(senha: string, custo: number): Promise<string> {
  return bcrypt.hash(senha, custo);
}

// Hash de uma senha qualquer, usado quando o e-mail não existe: o tempo de
// resposta fica igual ao de uma senha errada, sem revelar quem tem conta.
let hashFicticio: Promise<string> | undefined;

export async function conferirSenha(
  senha: string,
  hash: string | null | undefined,
  custo: number,
): Promise<boolean> {
  if (!hash) {
    hashFicticio ??= bcrypt.hash('senha-ficticia-para-tempo-constante', custo);
    await bcrypt.compare(senha, await hashFicticio);
    return false;
  }
  return bcrypt.compare(senha, hash);
}
