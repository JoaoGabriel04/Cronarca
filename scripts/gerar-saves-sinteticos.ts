// Gera saves SINTÉTICOS do esquema 8 rodando o código ANTIGO do game-core (o do
// commit 82a7407, antes da migração das classes), para testar a migração 8 → 9
// sem tocar em dados de usuários. Não substitui o dump real de produção.
//
// Uso (a pasta do código antigo vem do Git, só leitura):
//   mkdir -p /tmp/antigo && git archive 82a7407 packages/game-core | tar -x -C /tmp/antigo
//   ln -s "$PWD/node_modules" /tmp/antigo/node_modules
//   node scripts/gerar-saves-sinteticos.ts /tmp/antigo
// Grava packages/game-core/test/fixtures/sinteticos_v8.json (sem dados reais:
// nomes da lista fixa do jogo e sementes fixas, reproduzível).

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const pasta = process.argv[2];
if (!pasta) {
  console.error('Uso: node scripts/gerar-saves-sinteticos.ts <pasta com packages/game-core do commit 82a7407>');
  process.exit(2);
}
const antigo: any = await import(pathToFileURL(join(pasta, 'packages/game-core/src/index.ts')).href);
const { estadoInicial, liquidar, aplicarAcao, validarEstado } = antigo;

const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);
const MIN = 60_000;
const CLASSES_ANTIGAS = ['guerreiro', 'arqueiro', 'mago', 'ladino', 'clerigo'];

/** Estado do código antigo: tem de passar no esquema 8 antigo (é isso que o torna um save "de verdade"). */
const valido = (e: any) => {
  validarEstado(JSON.parse(JSON.stringify(e)), 8);
  return e;
};
const aplicar = (e: any, acao: any, agora = e.t) => {
  const r = aplicarAcao(e, acao, agora);
  if (!r.ok) throw new Error(`ação ${acao.tipo} recusada: ${r.erro}`);
  return r.estado;
};
const rico = (e: any) => {
  for (const r of Object.keys(e.recursos)) e.recursos[r] = 9_000_000_000;
  for (const id of ['armazem_1', 'celeiro_1']) e.slots[id].nivel = 10; // tetos altos para os recursos caberem
  return e;
};
const aventureiro = (e: any, base: any, i: number, classe: string, extra: Record<string, unknown>) => ({
  ...base, id: `a${100 + i}`, nome: `Sintetico${i}`, classe, ...extra,
});

const saves: { id: string; rev: number; versao_esquema: number; estado: any }[] = [];
const add = (id: string, estado: any, versao = 8, rev = 7) => saves.push({ id, rev, versao_esquema: versao, estado });

// 1. Conta nova.
add('sint-01-conta-nova', valido(estadoInicial({ semente: 101, agora: T0 })));

// 2. Uma de cada classe antiga, com níveis, XP, equipamento e estados variados (inclui um ferido).
{
  const e = estadoInicial({ semente: 102, agora: T0 });
  const base = e.aventureiros[0];
  e.aventureiros = CLASSES_ANTIGAS.map((classe, i) =>
    aventureiro(e, base, i, classe, {
      nivel: [1, 4, 9, 14, 20][i], xp: [0, 3, 11, 25, 0][i], arma: [0, 1, 3, 5, 6][i], armadura: [0, 2, 3, 4, 6][i],
      estado: i === 3 ? 'ferido' : 'na_vila', feridoAte: i === 3 ? T0 + 40 * MIN : null,
    }));
  e.proximoId = 105;
  add('sint-02-cinco-classes', valido(liquidar(e, T0 + 10 * MIN)));
}

// 3. Duas expedições em andamento (resultados já sorteados e guardados no segredo, como no jogo).
{
  let e = rico(estadoInicial({ semente: 103, agora: T0 }));
  const base = e.aventureiros[0];
  e.aventureiros = CLASSES_ANTIGAS.map((classe, i) => aventureiro(e, base, i, classe, { nivel: 3 + i, arma: i, armadura: i }));
  e.proximoId = 105;
  e = aplicar(e, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: ['a100', 'a101'] });
  e = aplicar(e, { tipo: 'partir_expedicao', destino: 'ruinas', grupo: ['a102', 'a103', 'a104'] });
  add('sint-03-expedicoes-em-andamento', valido(e));
}

// 4. Meio de jogo: contratações pelo sorteio do código antigo, obras, pesquisas, Mercador, eventos.
{
  let e = rico(estadoInicial({ semente: 104, agora: T0 }));
  for (let k = 0; k < 3; k++) e = aplicar(e, { tipo: 'contratar' }); // guilda de 4 vagas: o inicial e mais 3
  for (const slot of ['casa_1', 'serraria_1']) e = aplicar(e, { tipo: 'melhorar', slot });
  e = aplicar(e, { tipo: 'construir', slot: 'pedreira_1' });
  e = aplicar(e, { tipo: 'construir', slot: 'scriptorium_1' });
  e = liquidar(e, e.t + 30 * MIN);
  e = aplicar(e, { tipo: 'pesquisar', pesquisa: 'cartografia' });
  e = liquidar(e, e.t + 3 * MIN);
  // Aldeões em deslocamento e distribuição "manter" (esquema 6), como num save atual.
  e = aplicar(e, { tipo: 'alocar_aldeoes', de: 'fazendeiro', para: 'ocioso', quantidade: 1 });
  e = liquidar(e, e.t + 2 * 60 * MIN); // duas horas: eventos, chegadas de aldeões, Mercador
  add('sint-04-meio-de-jogo', valido(e));
}

// 5. Depois da ascensão: ciclo 2, Falha 1, relíquias, Diário (gerado pelo próprio código antigo).
{
  let e = rico(estadoInicial({ semente: 105, agora: T0 }));
  e.pesquisas.concluidas = ['hospitalidade', 'cartografia', 'colheita_farta', 'estradas_reais', 'carta_real'];
  e.objetivos.criptaVencida = true;
  e.aldeoes = Array.from({ length: 40 }, () => ({ oficio: 'fazendeiro' }));
  e.slots.casa_1.nivel = 10;
  for (let k = 0; k < 3; k++) e = aplicar(rico(e), { tipo: 'contratar' });
  e = aplicar(e, { tipo: 'ascender' });
  e = liquidar(e, e.t + 45 * MIN);
  add('sint-05-pos-ascensao', valido(e), 8, 31);
}

// 6 e 7. Esquemas mais antigos (derivados do 8: sem Diário no 7; sem Falha também no 6), para a cadeia de migração.
{
  const base = saves.find((s) => s.id === 'sint-04-meio-de-jogo')!.estado;
  const v7 = JSON.parse(JSON.stringify(base));
  delete v7.diario; delete v7.prologoVisto; v7.versao = 7;
  add('sint-06-esquema-7', v7, 7, 12);
  const v6 = JSON.parse(JSON.stringify(v7));
  delete v6.falha; v6.versao = 6;
  add('sint-07-esquema-6', v6, 6, 9);
}

const destino = new URL('../packages/game-core/test/fixtures/sinteticos_v8.json', import.meta.url);
writeFileSync(destino, JSON.stringify({
  sintetico: true,
  aviso: 'SAVES SINTÉTICOS: gerados pelo código antigo (esquema 8, commit 82a7407) com sementes fixas; não são dados de usuários e NÃO substituem o dump real de produção.',
  saves,
}, null, 1) + '\n');
const porClasse: Record<string, number> = {};
for (const s of saves) for (const a of s.estado.aventureiros) porClasse[a.classe] = (porClasse[a.classe] ?? 0) + 1;
console.log(`${saves.length} saves sintéticos gravados; aventureiros por classe antiga:`, porClasse);
console.log('expedições em andamento por save:', saves.map((s) => `${s.id}=${s.estado.expedicoes.length}`).join(', '));
