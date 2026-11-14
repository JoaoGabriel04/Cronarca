import type { LinhaRanking, RespostaRanking } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { abasRanking, dadosRanking, rotaRanking, textoAtualizado } from '../lib/casca/ranking';

const l = (posicao: number, nome: string, o: Partial<LinhaRanking> = {}): LinhaRanking => ({
  posicao, nome, era: 1, ciclo: 1, reliquias: 0, tempoJogadoMs: 0, voce: false, ...o,
});
const resposta = (linhas: LinhaRanking[], jogador: LinhaRanking | null): RespostaRanking => ({ aba: 'geral', era: null, linhas, jogador, geradoEm: 0 });

describe('modal Ranking', () => {
  it('selos nas três primeiras posições e colunas formatadas', () => {
    const d = dadosRanking(resposta([
      l(1, 'Isadora', { era: 3, ciclo: 4, reliquias: 1286, tempoJogadoMs: 41 * 3_600_000 }),
      l(2, 'Teo', { era: 3 }),
      l(3, 'Marcos V.', { era: 2 }),
      l(4, 'Lia', { tempoJogadoMs: 12 * 60_000 }),
    ], null));
    expect(d.linhas.map((x) => x.selo)).toEqual(['ouro', 'prata', 'bronze', null]);
    expect(d.linhas[0]).toMatchObject({ posicao: '1', nome: 'Isadora', era: 'III', ciclo: '4', reliquias: '1.286', tempo: '41h' });
    expect(d.linhas[3]!.tempo).toBe('12 min');
    expect(d.presa).toBeNull();
    expect(d.vazio).toBe(false);
  });

  it('o jogador fora da lista fica preso embaixo; dentro dela, não repete', () => {
    const eu = l(14, 'Gabriel', { voce: true, reliquias: 7 });
    expect(dadosRanking(resposta([l(1, 'Isadora')], eu)).presa).toMatchObject({ posicao: '14', voce: true });
    const dentro = l(2, 'Gabriel', { voce: true });
    const d = dadosRanking(resposta([l(1, 'Isadora'), dentro], dentro));
    expect(d.presa).toBeNull();
    expect(d.linhas[1]!.voce).toBe(true);
    expect(dadosRanking(resposta([], null)).vazio).toBe(true);
  });

  it('texto de atualização', () => {
    expect(textoAtualizado(0, 59_999)).toBe('atualizado agora');
    expect(textoAtualizado(0, 2 * 60_000)).toBe('atualizado há 2 min');
    expect(textoAtualizado(0, 125 * 60_000)).toBe('atualizado há 2 h');
    expect(textoAtualizado(10, 0)).toBe('atualizado agora');
  });

  it('abas: Geral, a era do jogador e Amigos desativada', () => {
    expect(abasRanking(1)).toEqual([
      { id: 'geral', rotulo: 'Geral', ativa: true },
      { id: 'era', rotulo: 'Era I', ativa: true },
      { id: 'amigos', rotulo: 'Amigos', ativa: false },
    ]);
    expect(rotaRanking('era')).toBe('/api/ranking?aba=era');
  });
});
