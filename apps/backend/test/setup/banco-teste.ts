// Setup global do Vitest no backend: garante o banco de teste e aplica as
// migrações nele. Os testes nunca tocam o banco de desenvolvimento.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';

export function urlBancoTeste(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error('DATABASE_URL_TEST não definida. Rode os testes com `make test`.');
  }
  const nome = new URL(url).pathname.slice(1);
  if (!nome.endsWith('_test')) {
    throw new Error(`O banco de teste precisa terminar em _test (recebido: "${nome}").`);
  }
  return url;
}

async function garantirBanco(urlTeste: string) {
  const alvo = new URL(urlTeste);
  const nome = alvo.pathname.slice(1);
  // Conecta no banco "postgres" do mesmo servidor para poder criar o de teste.
  const admin = new URL(urlTeste);
  admin.pathname = '/postgres';

  const cliente = new pg.Client({ connectionString: admin.toString() });
  await cliente.connect();
  try {
    const existe = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome]);
    if (existe.rowCount === 0) {
      await cliente.query(`CREATE DATABASE "${nome.replaceAll('"', '""')}"`);
    }
  } finally {
    await cliente.end();
  }
}

export default async function setup() {
  const url = urlBancoTeste();
  await garantirBanco(url);
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: path.resolve(import.meta.dirname, '../..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
