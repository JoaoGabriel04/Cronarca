import { describe, expect, it } from 'vitest';
import { AJUDA } from '../lib/casca/ajuda';

describe('ajuda dos cartões (portão de ajustes rápidos)', () => {
  it('aldeões e aventureiros: texto curto, sem emoji', () => {
    for (const { rotulo, texto } of Object.values(AJUDA)) {
      expect(`${rotulo} ${texto}`).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(texto.length).toBeLessThan(220);
    }
    expect(AJUDA.aldeoes.texto).toMatch(/^Gente da vila\./);
    expect(AJUDA.aventureiros.texto).toMatch(/^Heróis da guilda\./);
    expect(AJUDA.aventureiros.texto).toContain('Não ocupam moradia, mas comem.');
  });
});
