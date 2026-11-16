// Verificação offline da migração do save, 8 para 9 (Portão 20d-3). Não grava
// nada e não toca no banco: lê um arquivo e migra cada save em memória.
//
//   make conferir-migracao                       # saves SINTÉTICOS (fixture do código antigo), só para validar o script
//   make conferir-migracao ARQ=dumps/saves_producao.json   # o dump real de produção
//
// Como gerar o dump (no seu computador, somente leitura, só a tabela de saves,
// sem e-mail nem nome: só um identificador anônimo, a revisão, a versão e o estado):
//
//   mkdir -p dumps
//   export URL_RENDER='cole_a_external_database_url_aqui'
//   docker run --rm -e PGOPTIONS='-c default_transaction_read_only=on' postgres:17-alpine \
//     psql "$URL_RENDER?sslmode=require" -At \
//     -c "select coalesce(json_agg(t), '[]'::json) from (select left(md5(user_id::text), 10) as id, rev, versao_esquema, estado from game_states order by user_id) t" \
//     > dumps/saves_producao.json
//   unset URL_RENDER
//
// dumps/ está no .gitignore. Nunca commitar o dump; apagar depois de conferir:
//   rm dumps/saves_producao.json

import { readFileSync } from 'node:fs';
import { conferirSaves, lerSaves } from './lib/conferir-migracao.ts';

const FIXTURE = new URL('../packages/game-core/test/fixtures/sinteticos_v8.json', import.meta.url);
const arquivo = process.argv[2];

let conteudo: string;
try {
  conteudo = readFileSync(arquivo ?? FIXTURE, 'utf8');
} catch (erro) {
  console.error(`Não consegui ler ${arquivo ?? FIXTURE.pathname}: ${(erro as Error).message}`);
  process.exit(2);
}
let lido: ReturnType<typeof lerSaves>;
try {
  lido = lerSaves(conteudo);
} catch (erro) {
  console.error(`Arquivo inválido: ${(erro as Error).message}`);
  process.exit(2);
}
const relatorio = conferirSaves(lido.saves, { sintetico: lido.sintetico || !arquivo });
console.log(relatorio.texto);
if (arquivo && !lido.sintetico) console.log('\nLembrete: o dump tem dados de usuários. Apague depois de conferir: rm ' + arquivo);
process.exit(relatorio.falhas.length > 0 || relatorio.total === 0 ? 1 : 0);
