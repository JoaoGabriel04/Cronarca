// Calibragem do combate (Portão 20c; `make calibrar-combate`). Reproduzível:
// sementes fixas, sem relógio no resultado. Gera docs/CALIBRACAO_COMBATE.md.
//
// Decisão do dono (depois do 20b): a curva é íngreme (o mais forte vence quase
// sempre) e fica assim; o que decide é o preparo. Então medimos sobre
// composições e formações plausíveis, não sobre sorte:
// - "plausível": qualquer combinação das 4 classes no tamanho da tropa, e cada
//   classe numa linha que faz sentido para ela (corpo a corpo na frente ou no
//   meio; Arqueiro e Mago no meio ou atrás);
// - os 4 arquétipos: razoável (a composição do Eco: Lanceiro, Arqueiro,
//   Cavaleiro e Mago, nas linhas padrão), só corpo a corpo, só Arqueiros e Mago pesado;
// - jogador tipo: poder E(n), repartido igualmente entre as unidades (tropa
//   sintética: atributos da classe escalados até o poder, como os Ecos).
// Limiar de poder: a menor razão poder da tropa / poder do Eco com que a tropa
// vence a maioria das sementes (busca binária).
//
// Não grava nada no código: só o relatório com a proposta.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLASSES, classesDaComposicao, CURVA_ECO, PODER_FASE_BP, dificuldadeDaFase, gerarEco, poderDoEco, poderEsperado, poderUnidade, simularBatalha, tamanhoDoEco,
  unidadeComPoder, type Classe, type Linha, type NivelEco, type UnidadeCombate,
} from '../packages/game-core/src/index.ts';

const SEMENTES = [11, 23, 37, 41, 59];
const TAMANHOS = [3, 4, 5, 6, 7, 8];
/** Escala de referência para o limiar (grande, para o arredondamento dos atributos não pesar). */
const ESCALA_LIMIAR = 2_000;
const LINHAS_PLAUSIVEIS: Record<Classe, Linha[]> = { lanceiro: [0, 1], cavaleiro: [0, 1], arqueiro: [1, 2], mago_do_tempo: [1, 2] };
const NOMES: Record<Classe, string> = { lanceiro: 'Lan', cavaleiro: 'Cav', arqueiro: 'Arq', mago_do_tempo: 'Mag' };
const NIVEIS: NivelEco[] = ['facil', 'media', 'dificil', 'muito_dificil', 'chefe'];
const NOME_NIVEL: Record<NivelEco, string> = { facil: 'Fácil', media: 'Média', dificil: 'Difícil', muito_dificil: 'Muito difícil', chefe: 'Chefe' };

/** Uma tropa: quantas de cada classe e em que linha fica cada classe. */
interface Config {
  nome: string;
  classes: Classe[];
  linhas: Partial<Record<Classe, Linha>>;
}

function montar(c: Config, poder: number): UnidadeCombate[] {
  const n = c.classes.length;
  return c.classes.map((cl, i) => unidadeComPoder(cl, Math.floor(poder / n) + (i < poder % n ? 1 : 0), c.linhas[cl]));
}

/** Todas as tropas plausíveis de tamanho n (multiconjuntos de classes x linhas por classe). */
function plausiveis(n: number): Config[] {
  const out: Config[] = [];
  const contagens = (resto: number, k: number): number[][] => (k === CLASSES.length - 1 ? [[resto]] : Array.from({ length: resto + 1 }, (_, a) => contagens(resto - a, k + 1).map((r) => [a, ...r])).flat());
  for (const cont of contagens(n, 0)) {
    const presentes = CLASSES.filter((_, i) => cont[i]! > 0);
    const classes = CLASSES.flatMap((c, i) => Array.from({ length: cont[i]! }, () => c));
    let formacoes: Partial<Record<Classe, Linha>>[] = [{}];
    for (const c of presentes) formacoes = formacoes.flatMap((f) => LINHAS_PLAUSIVEIS[c].map((l) => ({ ...f, [c]: l })));
    for (const linhas of formacoes) {
      const nome = presentes.map((c) => `${cont[CLASSES.indexOf(c)]} ${NOMES[c]}@${linhas[c]}`).join(' + ');
      out.push({ nome, classes, linhas });
    }
  }
  return out;
}

const PADRAO: Partial<Record<Classe, Linha>> = { lanceiro: 0, cavaleiro: 0, arqueiro: 2, mago_do_tempo: 1 };
function arquetipos(n: number): Config[] {
  const alterna = (a: Classe, b: Classe) => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? a : b));
  return [
    { nome: 'Razoável (composição do Eco, linhas padrão)', classes: classesDaComposicao(n), linhas: PADRAO },
    { nome: 'Só corpo a corpo (Lanceiros e Cavaleiros na frente)', classes: alterna('lanceiro', 'cavaleiro'), linhas: PADRAO },
    { nome: 'Só Arqueiros (atrás)', classes: Array.from({ length: n }, () => 'arqueiro' as Classe), linhas: PADRAO },
    { nome: 'Mago pesado (metade Magos no meio, Lanceiros na frente)', classes: alterna('lanceiro', 'mago_do_tempo'), linhas: PADRAO },
  ];
}

/** Quantas sementes a tropa vence contra o Eco. */
function vitorias(c: Config, poder: number, eco: UnidadeCombate[]): number {
  let v = 0;
  for (const semente of SEMENTES) if (simularBatalha({ semente, ladoA: montar(c, poder), ladoB: eco, taticaA: 'equilibrada', taticaB: 'equilibrada' }).vencedor === 'A') v++;
  return v;
}
const vence = (c: Config, poder: number, eco: UnidadeCombate[]) => vitorias(c, poder, eco) * 2 > SEMENTES.length;

/** Menor razão tropa/Eco que vence a maioria das sementes (busca binária em milésimos, de 0,2 a 5). */
function limiar(c: Config, ecoPoder: number, eco: UnidadeCombate[]): number {
  let baixo = 200;
  let alto = 5_000;
  if (!vence(c, Math.round((ecoPoder * alto) / 1000), eco)) return alto;
  while (alto - baixo > 5) {
    const meio = Math.floor((baixo + alto) / 2);
    if (vence(c, Math.round((ecoPoder * meio) / 1000), eco)) alto = meio;
    else baixo = meio;
  }
  return alto;
}

const r2 = (milesimos: number) => (milesimos / 1000).toFixed(2).replace('.', ',');
const pct = (x: number) => `${Math.round(x * 100)}%`;
const quantil = (v: number[], q: number) => [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(q * v.length))]!;

// ---------- 1. Limiar por tamanho de tropa ----------
interface PorTamanho { n: number; total: number; limiares: number[]; melhor: { c: Config; l: number }; pior: { c: Config; l: number }; arq: { c: Config; l: number }[] }
const porTamanho: PorTamanho[] = [];
for (const n of TAMANHOS) {
  const ecoUnidades = gerarEcoComPoder(n, ESCALA_LIMIAR);
  const todas = plausiveis(n).map((c) => ({ c, l: limiar(c, ESCALA_LIMIAR, ecoUnidades) }));
  const ord = [...todas].sort((a, b) => a.l - b.l);
  const arq = arquetipos(n).map((c) => ({ c, l: limiar(c, ESCALA_LIMIAR, ecoUnidades) }));
  porTamanho.push({ n, total: todas.length, limiares: todas.map((x) => x.l), melhor: ord[0]!, pior: ord.at(-1)!, arq });
  console.log(`tropa de ${n}: ${todas.length} tropas plausíveis; limiar melhor ${r2(ord[0]!.l)}, razoável ${r2(arq[0]!.l)}, pior ${r2(ord.at(-1)!.l)}`);
}

/** Eco com n unidades e o poder dado (mesma composição de gerarEco). */
function gerarEcoComPoder(n: number, poder: number): UnidadeCombate[] {
  return montar({ nome: 'eco', classes: classesDaComposicao(n), linhas: PADRAO }, poder);
}

// ---------- 2. % de tropas plausíveis que vencem, por nível, com o jogador tipo em E(n) ----------
const FASES = Array.from({ length: 120 }, (_, i) => i + 1);
const porNivel = new Map<NivelEco, { vencem: number; total: number; arq: number[]; arqTotal: number }>(NIVEIS.map((nv) => [nv, { vencem: 0, total: 0, arq: [0, 0, 0, 0], arqTotal: 0 }]));
const porFaixa: { faixa: string; nivel: NivelEco; vencem: number; total: number }[] = [];
const cachePlausiveis = new Map(TAMANHOS.map((n) => [n, plausiveis(n)]));
for (const fase of FASES) {
  const eco = gerarEco(fase);
  const n = tamanhoDoEco(fase);
  const E = poderEsperado(fase);
  const lista = cachePlausiveis.get(n)!;
  // Amostra das tropas plausíveis (passo fixo; reproduzível) para o lote caber em poucos minutos.
  const passo = Math.max(1, Math.floor(lista.length / 60));
  let v = 0, t = 0;
  for (let i = 0; i < lista.length; i += passo) { t++; if (vence(lista[i]!, E, eco.unidades)) v++; }
  const acc = porNivel.get(eco.nivel)!;
  acc.vencem += v; acc.total += t;
  arquetipos(n).forEach((c, k) => { if (vence(c, E, eco.unidades)) acc.arq[k]!++; });
  acc.arqTotal++;
  const faixa = `${Math.floor((fase - 1) / 30) * 30 + 1}–${Math.floor((fase - 1) / 30) * 30 + 30}`;
  let f = porFaixa.find((x) => x.faixa === faixa && x.nivel === eco.nivel);
  if (!f) { f = { faixa, nivel: eco.nivel, vencem: 0, total: 0 }; porFaixa.push(f); }
  f.vencem += v; f.total += t;
}

// ---------- 3. Escala: o limiar muda com o tamanho do poder? ----------
const escalas = [100, 400, 2_000, 20_000].map((p) => {
  const eco = gerarEcoComPoder(3, p);
  return { p, razoavel: limiar(arquetipos(3)[0]!, p, eco), melhor: Math.min(...plausiveis(3).map((c) => limiar(c, p, eco))) };
});

// ---------- Relatório ----------
const melhorGeral = Math.max(...porTamanho.map((x) => x.melhor.l));
const razoavelGeral = Math.max(...porTamanho.map((x) => x.arq[0]!.l));
const linhas: string[] = [];
const L = (s = '') => linhas.push(s);
L('# Calibração do combate (Portão 20c)');
L();
L('Gerado por `make calibrar-combate` (`scripts/calibrar-combate.ts`). Sementes fixas: ' + SEMENTES.join(', ') + '. O script só mede: os valores em uso estão em `packages/game-core/data/combate.ts` (multiplicadores e poder mínimo/recomendado aprovados pelo dono no Portão 20c). Endurecimento e peso por classe no Poder seguem em aberto.');
L();
L('**Como ler.** A curva de vitória é íngreme (decisão do dono: sem crítico nem erro aleatório). Então a pergunta não é "com que sorte se vence", e sim "com que preparo". Medimos:');
L('- **tropas plausíveis**: todas as combinações das 4 classes no tamanho da tropa, cada classe numa linha que faz sentido (corpo a corpo na frente ou no meio; Arqueiro e Mago no meio ou atrás);');
L('- **arquétipos**: razoável (a composição do Eco, linhas padrão), só corpo a corpo, só Arqueiros, Mago pesado;');
L('- **jogador tipo**: poder E(n) repartido igualmente; o Eco é `gerarEco(n)` (mesmo tamanho de tropa);');
L('- **limiar de poder**: a menor razão poder da tropa / poder do Eco com que a tropa vence a maioria das sementes. Abaixo dele perde, acima vence: é onde a vitória "vira".');
L('- vencer uma fase = vencer a maioria das ' + SEMENTES.length + ' sementes, com tática equilibrada.');
L();
L('## 1. Limiar de poder por tamanho de tropa');
L();
L('| Tropa | Tropas plausíveis | Melhor contra-escalação | Razoável | Pior | Largura (pior / melhor) | Mediana das plausíveis |');
L('|---|---|---|---|---|---|---|');
for (const x of porTamanho) L(`| ${x.n} | ${x.total} | ${r2(x.melhor.l)} | ${r2(x.arq[0]!.l)} | ${r2(x.pior.l)} | ${(x.pior.l / x.melhor.l).toFixed(2).replace('.', ',')}x | ${r2(quantil(x.limiares, 0.5))} |`);
L();
L('Melhor e pior tropa de cada tamanho:');
L();
for (const x of porTamanho) L(`- **${x.n}**: melhor ${x.melhor.c.nome} (${r2(x.melhor.l)}); pior ${x.pior.c.nome} (${r2(x.pior.l)}).`);
L();
L('Arquétipos (limiar):');
L();
L('| Tropa | ' + arquetipos(3).map((a) => a.nome).join(' | ') + ' |');
L('|---|' + arquetipos(3).map(() => '---').join('|') + '|');
for (const x of porTamanho) L(`| ${x.n} | ${x.arq.map((a) => r2(a.l)).join(' | ')} |`);
L();
L('Escala (tropa de 3): o limiar quase não depende do tamanho do poder; só no começo (poder pequeno, atributos pequenos) o arredondamento pesa.');
L();
L('| Poder do Eco | Razoável | Melhor |');
L('|---|---|---|');
for (const e of escalas) L(`| ${e.p} | ${r2(e.razoavel)} | ${r2(e.melhor)} |`);
L();
L('## 2. Jogador tipo em E(n): % de tropas plausíveis que vencem, por nível');
L();
L('Fases 1 a 120 (todas), amostra fixa de cerca de 60 tropas plausíveis por fase.');
L();
L('| Nível | Multiplicador (sem endurecimento) | % das plausíveis que vencem | Razoável vence | Só corpo a corpo | Só Arqueiros | Mago pesado |');
L('|---|---|---|---|---|---|---|');
// Multiplicadores atuais, lidos dos dados (o relatório sempre mostra o que está no código).
const multDe = (nivel: NivelEco) => [...new Set(CURVA_ECO.ciclo.filter((c) => c.nivel === nivel).map((c) => c.mult))].concat(nivel === 'chefe' ? [CURVA_ECO.chefe.mult] : []).map((m) => r2(m * 10)).join(' / ');
const MULTS: Record<NivelEco, string> = { facil: multDe('facil'), media: multDe('media'), dificil: multDe('dificil'), muito_dificil: multDe('muito_dificil'), chefe: multDe('chefe') };
for (const nv of NIVEIS) {
  const a = porNivel.get(nv)!;
  L(`| ${NOME_NIVEL[nv]} | ${MULTS[nv]} | ${pct(a.vencem / a.total)} | ${a.arq.map((k) => pct(k / a.arqTotal)).join(' | ')} |`);
}
L();
L('Por faixa de fases (o endurecimento soma +0,05 a cada 30 fases nos difíceis, muito difíceis e chefes):');
L();
L('| Faixa | ' + NIVEIS.map((nv) => NOME_NIVEL[nv]).join(' | ') + ' |');
L('|---|' + NIVEIS.map(() => '---').join('|') + '|');
for (const faixa of [...new Set(porFaixa.map((x) => x.faixa))]) {
  L(`| ${faixa} | ${NIVEIS.map((nv) => { const f = porFaixa.find((x) => x.faixa === faixa && x.nivel === nv); return f ? pct(f.vencem / f.total) : '—'; }).join(' | ')} |`);
}
L();
L('## 3. Multiplicador do Eco x % de tropas plausíveis que vencem (jogador tipo em E(n))');
L();
L('Pelos limiares da seção 1: uma tropa vence o Eco de multiplicador m quando o limiar dela é ≤ 1/m. Média simples entre os tamanhos de tropa (3 a 8).');
L();
const CANDIDATOS = [75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 145, 170];
const fracao = (m: number) => porTamanho.reduce((s, x) => s + x.limiares.filter((l) => l * m <= 1_000 * 100).length / x.limiares.length, 0) / porTamanho.length;
L('| Multiplicador | ' + CANDIDATOS.map((m) => r2(m * 10)).join(' | ') + ' |');
L('|---|' + CANDIDATOS.map(() => '---').join('|') + '|');
L('| % das plausíveis que vencem | ' + CANDIDATOS.map((m) => pct(fracao(m))).join(' | ') + ' |');
L('| Razoável vence? | ' + CANDIDATOS.map((m) => (porTamanho.every((x) => x.arq[0]!.l * m <= 100_000) ? 'sim' : porTamanho.some((x) => x.arq[0]!.l * m <= 100_000) ? 'às vezes' : 'não')).join(' | ') + ' |');
L('| Melhor contra-escalação vence? | ' + CANDIDATOS.map((m) => (porTamanho.every((x) => x.melhor.l * m <= 100_000) ? 'sim' : porTamanho.some((x) => x.melhor.l * m <= 100_000) ? 'às vezes' : 'não')).join(' | ') + ' |');
L();
/** Maior multiplicador (dos candidatos) em que ainda vence pelo menos a fração dada das plausíveis. */
const multPara = (alvo: number) => [...CANDIDATOS].reverse().find((m) => fracao(m) >= alvo) ?? CANDIDATOS[0]!;
const METAS: [string, number, string][] = [
  ['Fácil', 0.9, 'quase qualquer tropa plausível vence'],
  ['Média', 0.6, 'a composição razoável vence; tropas mal montadas, não'],
  ['Difícil', 0.3, 'só tropas bem montadas (contra-escalação ou formação boa)'],
  ['Muito difícil', 0.1, 'só as melhores contra-escalações'],
  ['Chefe', 0.02, 'nem a melhor tropa vence em E(n): pede poder acima do esperado ("com preparo, sobe")'],
];
L('## 4. Metas (seção 1.6, reescritas) e multiplicadores');
L();
L('Metas em % das tropas plausíveis que vencem com o jogador tipo em E(n) (sem endurecimento), o multiplicador que as entrega pelos limiares e o que está no código. A medição direta da seção 2 inclui o endurecimento e por isso fica abaixo nos difíceis.');
L();
L('| Nível | Meta | O que significa | Multiplicador pelos limiares | No código |');
L('|---|---|---|---|---|');
const ATUAL = NIVEIS.map((nv) => MULTS[nv]);
METAS.forEach(([nome, alvo, txt], i) => {
  const m = nome === 'Chefe' ? Math.min(...CANDIDATOS.filter((c) => fracao(c) === 0)) : multPara(alvo);
  L(`| ${nome} | ${nome === 'Chefe' ? '0% em E(n)' : `cerca de ${pct(alvo)}`} | ${txt} | ${r2(m * 10)} (${pct(fracao(m))}) | ${ATUAL[i]} |`);
});
L();
L('## 5. Poder mínimo e recomendado');
L();
L(`- **Poder mínimo** = o limiar da melhor contra-escalação: **${r2(melhorGeral)} do poder do Eco** (o maior entre os tamanhos de tropa, para nunca bloquear quem montou a melhor tropa). Abaixo disso nenhuma tropa plausível vence; a partir dele, só quem contra-escala bem. Hoje no código: ${r2(PODER_FASE_BP.minimo / 10)}.`);
L(`- **Poder recomendado** = o limiar da composição razoável: **${r2(razoavelGeral)} do poder do Eco**. Hoje no código: ${r2(PODER_FASE_BP.recomendado / 10)}.`);
L(`- **Largura da faixa** (pior / melhor): de ${Math.min(...porTamanho.map((x) => x.pior.l / x.melhor.l)).toFixed(2).replace('.', ',')}x a ${Math.max(...porTamanho.map((x) => x.pior.l / x.melhor.l)).toFixed(2).replace('.', ',')}x conforme o tamanho da tropa. É o quanto o planejamento vale: a mesma tropa em poder, mal montada, precisa desse fator a mais de poder para vencer.`);
writeFileSync(join(import.meta.dirname, '..', 'docs', 'CALIBRACAO_COMBATE.md'), linhas.join('\n') + '\n');
console.log('relatório em docs/CALIBRACAO_COMBATE.md');
// Evita aviso de importação sem uso quando a lista de funções muda.
void poderUnidade; void poderDoEco; void dificuldadeDaFase;
