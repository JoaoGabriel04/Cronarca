import { describe, expect, it } from 'vitest';
import { RANKING } from '../data/ranking.ts';
import {
  chaveRanking, compararRanking, esquemaRespostaRanking, formatarTempoJogado, mudouMarco, nomePublico, somaDeAtividade,
} from '../src/ranking.ts';
import { novo } from './ajuda.ts';

const linha = (era: number, ciclo: number, reliquias: number, marcoEm: number, userId: string) => ({ era, ciclo, reliquias, marcoEm, userId });

describe('ranking', () => {
  it('a chave sai do estado: era, ciclo e relíquias totais (as gastas contam)', () => {
    const e = novo();
    e.ciclo = 3;
    e.reliquias = { total: 12, gastas: 5, niveis: {} };
    expect(chaveRanking(e)).toEqual({ era: 1, ciclo: 3, reliquias: 12 });
  });

  it('marco = mudou era, ciclo ou relíquias', () => {
    const a = { era: 1, ciclo: 1, reliquias: 0 };
    expect(mudouMarco(a, { ...a })).toBe(false);
    expect(mudouMarco(a, { ...a, ciclo: 2 })).toBe(true);
    expect(mudouMarco(a, { ...a, era: 2 })).toBe(true);
    expect(mudouMarco(a, { ...a, reliquias: 3 })).toBe(true);
  });

  it('ordena por era, ciclo e relíquias desc; empate vai para quem chegou primeiro', () => {
    const lista = [
      linha(1, 4, 40, 10, 'nina'),
      linha(3, 3, 74, 10, 'teo'),
      linha(2, 5, 61, 10, 'marcos'),
      linha(3, 4, 86, 10, 'isadora'),
      linha(1, 4, 40, 5, 'cedo'),
      linha(1, 4, 40, 5, 'abel'),
      linha(2, 5, 70, 99, 'rico'),
    ];
    expect(lista.sort(compararRanking).map((l) => l.userId)).toEqual(['isadora', 'teo', 'rico', 'marcos', 'abel', 'cedo', 'nina']);
  });

  it('tempo jogado soma só intervalos dentro da janela', () => {
    const J = RANKING.janelaAtividadeMs;
    expect(somaDeAtividade(null, 1000, J)).toBe(0);
    expect(somaDeAtividade(1000, 31_000, J)).toBe(30_000);
    expect(somaDeAtividade(0, J, J)).toBe(J);
    expect(somaDeAtividade(0, J + 1, J)).toBe(0);
    // Relógio para trás ou a mesma hora: nada.
    expect(somaDeAtividade(5000, 5000, J)).toBe(0);
    expect(somaDeAtividade(5000, 4000, J)).toBe(0);
  });

  it('nome público: primeiro nome e inicial do último sobrenome', () => {
    expect(nomePublico('Marcos Vieira')).toBe('Marcos V.');
    expect(nomePublico('  ana   maria de   souza ')).toBe('ana S.');
    expect(nomePublico('Isadora')).toBe('Isadora');
    expect(nomePublico('Lia éboli')).toBe('Lia É.');
    expect(nomePublico('   ')).toBe('Aventureiro');
  });

  it('tempo: minutos abaixo de 1 h, horas inteiras depois', () => {
    expect(formatarTempoJogado(0)).toBe('0 min');
    expect(formatarTempoJogado(59_999)).toBe('0 min');
    expect(formatarTempoJogado(45 * 60_000)).toBe('45 min');
    expect(formatarTempoJogado(60 * 60_000)).toBe('1h');
    expect(formatarTempoJogado(41 * 3_600_000 + 59 * 60_000)).toBe('41h');
  });

  it('o esquema da resposta recusa campo a mais (nada de e-mail ou id)', () => {
    const l = { posicao: 1, nome: 'Teo', era: 1, ciclo: 1, reliquias: 0, tempoJogadoMs: 0, voce: true };
    const r = { aba: 'geral', era: null, linhas: [l], jogador: l, geradoEm: 0 };
    expect(esquemaRespostaRanking.parse(r)).toEqual(r);
    expect(() => esquemaRespostaRanking.parse({ ...r, linhas: [{ ...l, userId: 'x' }] })).toThrow();
  });
});
