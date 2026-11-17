// Verificação offline da migração do convidado (Portão B, como o 20d-3): cria um banco DESCARTÁVEL no
// Postgres local do Docker (nunca produção), aplica as migrações anteriores, insere dados sintéticos,
// aplica 20261117120000_convidado e confere que nada se perdeu. Apaga o banco no fim.
//
//   make conferir-migracao-convidado
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const MIGRACOES = path.resolve(import.meta.dirname, '../apps/backend/prisma/migrations');
const NOVA = '20261117120000_convidado';
const NOME_BANCO = 'conferir_convidado_tmp';

const base = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!base) {
  console.error('Sem DATABASE_URL_TEST nem DATABASE_URL (rode com `make conferir-migracao-convidado`).');
  process.exit(2);
}
const alvo = new URL(base);
if (!['db', 'localhost', '127.0.0.1'].includes(alvo.hostname)) {
  console.error(`Recusado: o servidor "${alvo.hostname}" não é o Postgres local do Docker. Este script nunca toca em produção.`);
  process.exit(2);
}
const admin = new URL(base);
admin.pathname = '/postgres';
const tmp = new URL(base);
tmp.pathname = `/${NOME_BANCO}`;

const falhas: string[] = [];
const confere = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? 'ok     ' : 'FALHOU '} ${msg}`);
  if (!ok) falhas.push(msg);
};

const sql = (dir: string) => readFileSync(path.join(MIGRACOES, dir, 'migration.sql'), 'utf8');
const anteriores = readdirSync(MIGRACOES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name < NOVA)
  .map((d) => d.name)
  .sort();

const a = new pg.Client({ connectionString: admin.toString() });
await a.connect();
await a.query(`DROP DATABASE IF EXISTS ${NOME_BANCO}`);
await a.query(`CREATE DATABASE ${NOME_BANCO}`);
const c = new pg.Client({ connectionString: tmp.toString() });
try {
  await c.connect();
  console.log(`migrações anteriores aplicadas: ${anteriores.join(', ')}`);
  for (const dir of anteriores) await c.query(sql(dir));

  // Dados sintéticos no esquema antigo: com senha, só OAuth, com estado, sessão, log e ranking.
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'];
  await c.query(
    `INSERT INTO users (id, email, nome, senha_hash, email_verificado, atualizado_em) VALUES
       ($1, 'a@teste.local', 'A', 'hash', false, now()),
       ($2, 'b@teste.local', 'B', NULL, true, now()),
       ($3, 'c@teste.local', 'C', 'hash', true, now())`,
    ids,
  );
  await c.query(`INSERT INTO oauth_accounts (id, user_id, provedor, provider_account_id) VALUES ('10000000-0000-4000-8000-000000000001', $1, 'google', 'g-1')`, [ids[1]]);
  await c.query(`INSERT INTO sessions (id, user_id, token_hash, expira_em) VALUES ('20000000-0000-4000-8000-000000000001', $1, 'th', now() + interval '1 day')`, [ids[0]]);
  await c.query(`INSERT INTO game_states (user_id, rev, atualizado_em, estado, versao_esquema) SELECT unnest($1::uuid[]), 7, now(), '{"x":1}', 9`, [ids]);
  await c.query(`INSERT INTO action_logs (id, user_id, idempotency_key, tipo, resultado, rev) VALUES ('30000000-0000-4000-8000-000000000001', $1, 'k', 'clique', '{}', 7)`, [ids[0]]);
  await c.query(`INSERT INTO ranking_entries (user_id, era, ciclo, reliquias, marco_em, atualizado_em) SELECT unnest($1::uuid[]), 1, 2, 3, now(), now()`, [ids]);

  const contagens = async () => {
    const t = ['users', 'oauth_accounts', 'sessions', 'game_states', 'action_logs', 'ranking_entries'];
    const r: Record<string, number> = {};
    for (const n of t) r[n] = Number((await c.query(`SELECT count(*) FROM ${n}`)).rows[0].count);
    return r;
  };
  const antes = await contagens();
  const emailsAntes = (await c.query('SELECT id, email FROM users ORDER BY id')).rows;

  console.log(`aplicando ${NOVA}`);
  await c.query(sql(NOVA));

  const depois = await contagens();
  console.log('contagens antes:', JSON.stringify(antes));
  console.log('contagens depois:', JSON.stringify(depois));
  confere(JSON.stringify(antes) === JSON.stringify(depois), 'mesmas contagens em todas as tabelas');
  confere(JSON.stringify((await c.query('SELECT id, email FROM users ORDER BY id')).rows) === JSON.stringify(emailsAntes), 'e-mails e ids preservados');
  confere(Number((await c.query('SELECT count(*) FROM users WHERE convidado = false')).rows[0].count) === 3, 'todos os usuários existentes com convidado = false');

  const dup = await c.query(`INSERT INTO users (id, email, nome, atualizado_em) VALUES ('00000000-0000-4000-8000-000000000009', 'a@teste.local', 'X', now())`).then(() => false, (e) => e.code === '23505');
  confere(dup, 'o índice único de e-mail continua recusando e-mail repetido');
  const nulos = await c
    .query(`INSERT INTO users (id, email, nome, convidado, atualizado_em) VALUES ('00000000-0000-4000-8000-0000000000a1', NULL, 'Convidado 1', true, now()), ('00000000-0000-4000-8000-0000000000a2', NULL, 'Convidado 2', true, now())`)
    .then(() => true, () => false);
  confere(nulos, 'dois usuários sem e-mail convivem com o índice único');
  const cascata = await c.query(`DELETE FROM users WHERE id = $1`, [ids[0]]);
  confere(cascata.rowCount === 1 && Number((await c.query('SELECT count(*) FROM game_states WHERE user_id = $1', [ids[0]])).rows[0].count) === 0, 'a cascata (estado do jogo) continua valendo');
} finally {
  await c.end().catch(() => {});
  await a.query(`DROP DATABASE IF EXISTS ${NOME_BANCO}`);
  await a.end();
}
if (falhas.length) {
  console.log(`\n${falhas.length} falha(s)`);
  process.exit(1);
}
console.log('\ntudo ok; o banco descartável foi apagado e nada de produção foi tocado');
