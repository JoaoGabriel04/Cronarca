// Simulador de batalha (Portão 20b; CRONARCA_COMBATE_E_MAPA.md 1.3). Puro,
// determinístico e inteiro: mesma entrada e mesma semente dão o mesmo log.
// Sem relógio (ticks de 100 ms de jogo) e sem Math.random (mulberry32 de rng.ts).
//
// Geometria por linhas, sem movimento livre: cada lado em 3 linhas (0 frente,
// 1 meio, 2 trás). As linhas se fecham: a linha efetiva de uma unidade é a
// posição da linha dela entre as linhas do seu lado que ainda têm alguém de pé.
// A unidade na linha efetiva i ataca a linha efetiva j do inimigo se
// i + j + 1 <= alcance. Alvo: corpo a corpo, a linha da frente; Arqueiro, quem
// tiver menos vida entre as linhas alcançáveis; Mago do Tempo, a linha
// alcançável com mais gente (até 2 alvos). Empates pelo índice.
//
// Em cada tick, todos os prontos escolhem alvo e calculam o dano com o estado
// do começo do tick; o dano entra junto (ninguém leva vantagem por ordem).
//
// LOG (contrato com o replay; tudo inteiro):
//   [VERSAO_LOG, nA, nB, ...cabeçalho, ...eventos]
//   cabeçalho: 3 inteiros por unidade, A e depois B: [classe (índice em CLASSES), linha, vida inicial]
//   evento: 5 inteiros [tick, autor, alvo, dano, marcas]
//     autor e alvo: lado A = 0..nA-1; lado B = 100..100+nB-1
//     marcas (soma): 1 vantagem, 2 desvantagem, 4 queda do alvo, 8 atraso (Mago), 16 pressa (autor acelerado)

import { CLASSES } from '../../data/aventureiros.ts';
import {
  AJUSTE_TATICA, FATOR_DEFESA, LIMITE_TICKS, LINHAS, MAGO, VANTAGEM_BP, VARIACAO_DANO_BP, VENCE, type Tatica,
} from '../../data/combate.ts';
import { criarSorteador } from '../rng.ts';
import type { UnidadeCombate } from './unidade.ts';

export const VERSAO_LOG = 1;
export const BASE_LADO_B = 100;
export const MARCA = { vantagem: 1, desvantagem: 2, queda: 4, atraso: 8, pressa: 16 } as const;

export interface EntradaBatalha {
  semente: number;
  ladoA: readonly UnidadeCombate[];
  ladoB: readonly UnidadeCombate[];
  taticaA: Tatica;
  taticaB: Tatica;
  limiteTicks?: number;
}

export interface ResultadoBatalha {
  /** Quem venceu. No limite de tempo, mais vida total restante; empate, o lado B (o Eco defende). */
  vencedor: 'A' | 'B';
  vidaRestanteA: number;
  vidaRestanteB: number;
  /** Tick em que a batalha acabou. */
  ticks: number;
  log: number[];
}

const NUNCA = Number.MAX_SAFE_INTEGER;
const indiceClasse = new Map(CLASSES.map((c, i) => [c, i]));

export function simularBatalha(entrada: EntradaBatalha): ResultadoBatalha {
  const { ladoA, ladoB } = entrada;
  const limite = entrada.limiteTicks ?? LIMITE_TICKS;
  const s = criarSorteador(entrada.semente);
  const nA = ladoA.length;
  const n = nA + ladoB.length;
  const unidades = [...ladoA, ...ladoB];

  // Estado por unidade em vetores (sem objetos por tick).
  const lado = new Uint8Array(n);
  const vida = new Int32Array(n);
  const proximo = new Float64Array(n); // tick do próximo ataque (inteiro; NUNCA = esperando alvo)
  /** Tática em pontos-base (10 000 = normal): dano causado e dano recebido. */
  const causadoBp = new Int32Array(n);
  const recebidoBp = new Int32Array(n);
  const efetiva = new Int8Array(n); // linha efetiva (fechada)
  const log: number[] = [VERSAO_LOG, nA, ladoB.length];

  for (let i = 0; i < n; i++) {
    const u = unidades[i]!;
    lado[i] = i < nA ? 0 : 1;
    vida[i] = u.vida;
    // Primeiro golpe: a aproximação mais uma defasagem sorteada dentro do intervalo, para os dois lados
    // não baterem sempre no mesmo tick (sem isso, a queda mútua decidia o espelho).
    proximo[i] = u.aproximacao + s.inteiro(0, u.intervalo - 1);
    const t = AJUSTE_TATICA[i < nA ? entrada.taticaA : entrada.taticaB];
    causadoBp[i] = 10_000 + t.ataque;
    recebidoBp[i] = 10_000 - t.defesa;
    log.push(indiceClasse.get(u.classe)!, u.linha, u.vida);
  }

  /** Fecha as linhas: cada unidade viva recebe a posição da sua linha entre as linhas ocupadas do seu lado. */
  const fecharLinhas = () => {
    for (let l = 0; l < 2; l++) {
      const ocupada = [false, false, false];
      for (let i = 0; i < n; i++) if (lado[i] === l && vida[i]! > 0) ocupada[unidades[i]!.linha] = true;
      const posicao = [0, 0, 0];
      let k = 0;
      for (let linha = 0; linha < LINHAS; linha++) if (ocupada[linha]) posicao[linha] = k++;
      for (let i = 0; i < n; i++) if (lado[i] === l) efetiva[i] = posicao[unidades[i]!.linha]!;
    }
  };
  fecharLinhas();

  const vivos = (l: number) => {
    let c = 0;
    for (let i = 0; i < n; i++) if (lado[i] === l && vida[i]! > 0) c++;
    return c;
  };

  /** Alvos do atacante (até `alvos`), ou vazio se ninguém está ao alcance. */
  const escolher = (i: number): number[] => {
    const u = unidades[i]!;
    const outro = 1 - lado[i]!;
    const alcanceJ = u.alcance - efetiva[i]! - 1; // maior linha efetiva inimiga alcançável
    if (alcanceJ < 0) return [];
    let melhor = -1;
    if (u.alvos > 1) {
      // Mago: a linha alcançável com mais gente; nela, os de menos vida.
      const porLinha = [0, 0, 0];
      for (let j = 0; j < n; j++) if (lado[j] === outro && vida[j]! > 0 && efetiva[j]! <= alcanceJ) porLinha[efetiva[j]!]!++;
      let linha = -1;
      for (let l = 0; l < LINHAS; l++) if (porLinha[l]! > 0 && (linha < 0 || porLinha[l]! > porLinha[linha]!)) linha = l;
      if (linha < 0) return [];
      const nalinha: number[] = [];
      for (let j = 0; j < n; j++) if (lado[j] === outro && vida[j]! > 0 && efetiva[j] === linha) nalinha.push(j);
      nalinha.sort((a, b) => vida[a]! - vida[b]! || a - b);
      return nalinha.slice(0, u.alvos);
    }
    const corpoACorpo = u.alcance <= 1;
    for (let j = 0; j < n; j++) {
      if (lado[j] !== outro || vida[j]! <= 0) continue;
      const lj = efetiva[j]!;
      if (lj > alcanceJ || (corpoACorpo && lj !== 0)) continue;
      if (melhor < 0) { melhor = j; continue; }
      // Corpo a corpo: a linha mais próxima, depois menos vida. Arqueiro: menos vida em qualquer linha alcançável.
      const lm = efetiva[melhor]!;
      if (!corpoACorpo && vida[j]! < vida[melhor]!) melhor = j;
      else if (corpoACorpo && (lj < lm || (lj === lm && vida[j]! < vida[melhor]!))) melhor = j;
    }
    return melhor < 0 ? [] : [melhor];
  };

  /** Mago do Tempo vivo do mesmo lado, na mesma linha efetiva ou na vizinha (não acumula). */
  const apressado = (i: number): boolean => {
    for (let m = 0; m < n; m++) {
      if (m === i || lado[m] !== lado[i] || vida[m]! <= 0 || unidades[m]!.alvos <= 1) continue;
      if (Math.abs(efetiva[m]! - efetiva[i]!) <= 1) return true;
    }
    return false;
  };

  const golpes: { autor: number; alvo: number; dano: number; marcas: number }[] = [];
  let tick = 0;
  let fim = -1;
  while (fim < 0) {
    // Próximo tick em que alguém ataca.
    let t = NUNCA;
    for (let i = 0; i < n; i++) if (vida[i]! > 0 && proximo[i]! < t) t = proximo[i]!;
    if (t > limite) { tick = limite; break; }
    tick = t;
    golpes.length = 0;
    for (let i = 0; i < n; i++) {
      if (vida[i]! <= 0 || proximo[i] !== tick) continue;
      const alvos = escolher(i);
      if (alvos.length === 0) { proximo[i] = NUNCA; continue; } // espera alguém ficar ao alcance
      const u = unidades[i]!;
      const pressa = apressado(i);
      const intervalo = pressa ? Math.max(1, Math.floor((u.intervalo * MAGO.pressaPermil) / 1000)) : u.intervalo;
      proximo[i] = tick + intervalo;
      for (const j of alvos) {
        const alvo = unidades[j]!;
        const vence = VENCE[u.classe];
        const perde = VENCE[alvo.classe] === u.classe;
        const vant = vence === alvo.classe ? VANTAGEM_BP.favor : perde ? VANTAGEM_BP.contra : VANTAGEM_BP.neutro;
        const variacao = s.inteiro(VARIACAO_DANO_BP[0], VARIACAO_DANO_BP[1]);
        // Multiplicadores em pontos-base, um de cada vez (precisão de 1/10 000); o dano só arredonda no fim.
        let multBp = Math.floor((vant * variacao) / 10_000);
        multBp = Math.floor((multBp * causadoBp[i]!) / 10_000);
        multBp = Math.floor((multBp * recebidoBp[j]!) / 10_000);
        const dano = Math.max(1, Math.floor((u.ataque * multBp * 100) / (10_000 * (100 + FATOR_DEFESA * alvo.defesa))));
        let marcas = (vence === alvo.classe ? MARCA.vantagem : 0) | (perde ? MARCA.desvantagem : 0) | (pressa ? MARCA.pressa : 0);
        if (u.alvos > 1) marcas |= MARCA.atraso;
        golpes.push({ autor: i, alvo: j, dano, marcas });
      }
    }
    // O dano do tick entra junto.
    let caiu = false;
    for (const g of golpes) {
      if (vida[g.alvo]! <= 0 && g.dano > 0) {
        // Já caiu neste tick por outro golpe: o golpe ainda é registrado, sem dano.
        log.push(tick, idLog(g.autor, nA), idLog(g.alvo, nA), 0, g.marcas & ~MARCA.queda);
        continue;
      }
      vida[g.alvo] = vida[g.alvo]! - g.dano;
      let marcas = g.marcas;
      if (vida[g.alvo]! <= 0) {
        vida[g.alvo] = 0;
        marcas |= MARCA.queda;
        caiu = true;
      } else if (marcas & MARCA.atraso && proximo[g.alvo]! !== NUNCA) {
        proximo[g.alvo] = proximo[g.alvo]! + MAGO.atrasoTicks;
      }
      log.push(tick, idLog(g.autor, nA), idLog(g.alvo, nA), g.dano, marcas);
    }
    if (caiu) {
      fecharLinhas();
      if (vivos(0) === 0 || vivos(1) === 0) { fim = tick; break; }
      // Quem esperava alvo tenta de novo no próximo tick.
      for (let i = 0; i < n; i++) if (vida[i]! > 0 && proximo[i] === NUNCA) proximo[i] = tick + 1;
    }
  }

  let vidaA = 0;
  let vidaB = 0;
  for (let i = 0; i < n; i++) if (lado[i] === 0) vidaA += vida[i]!; else vidaB += vida[i]!;
  const vencedor = vidaA === 0 ? 'B' : vidaB === 0 ? 'A' : vidaA > vidaB ? 'A' : 'B';
  return { vencedor, vidaRestanteA: vidaA, vidaRestanteB: vidaB, ticks: fim >= 0 ? fim : tick, log };
}

const idLog = (i: number, nA: number) => (i < nA ? i : BASE_LADO_B + i - nA);
