// Marca (portão Logo e ícone): todo ícone e imagem declarados existem, com o
// tamanho que declaram, e a arte respeita a grade de pixels inteiros.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../app/manifest';
import { MARCA } from '../lib/marca';
import { decodificarPng, PASTA_PUBLICA } from './png';

const doPublico = (src: string) => readFileSync(join(PASTA_PUBLICA, src));

/** Largura, altura e tipo de cor do cabeçalho IHDR (2 = RGB, 6 = RGBA). */
function cabecalhoPng(buf: Buffer) {
  expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20), cor: buf[25] };
}

/** Quantos pixels quebram a grade de blocos k x k (0 = ampliação inteira e limpa). */
function foraDaGrade(buf: Buffer, k: number): number {
  const img = decodificarPng(buf);
  let fora = 0;
  for (let y = 0; y < img.altura; y++) {
    for (let x = 0; x < img.largura; x++) {
      const i = (y * img.largura + x) * 4;
      const j = (Math.floor(y / k) * k * img.largura + Math.floor(x / k) * k) * 4;
      for (let c = 0; c < 4; c++) {
        if (img.dados[i + c] !== img.dados[j + c]) {
          fora++;
          break;
        }
      }
    }
  }
  return fora;
}

describe('marca: ícones do navegador', () => {
  it('favicon.ico traz o 16 desenhado à mão e o 32, como PNG', () => {
    const ico = doPublico('favicon.ico');
    expect(ico.readUInt16LE(2)).toBe(1); // tipo ícone
    const n = ico.readUInt16LE(4);
    const imagens = new Map<number, Buffer>();
    for (let i = 0; i < n; i++) {
      const e = 6 + 16 * i;
      const lado = ico[e] || 256;
      const inicio = ico.readUInt32LE(e + 12);
      const png = ico.subarray(inicio, inicio + ico.readUInt32LE(e + 8));
      expect(cabecalhoPng(png)).toMatchObject({ largura: lado, altura: lado });
      imagens.set(lado, png);
    }
    expect([...imagens.keys()].sort((a, b) => a - b)).toEqual([16, 32]);
    // As imagens são as entregues, sem reamostrar: o 16 desenhado à mão e o 32 do icon.png.
    expect(imagens.get(16)!.equals(doPublico(MARCA.selo(16)))).toBe(true);
    expect(imagens.get(32)!.equals(doPublico(MARCA.selo(32)))).toBe(true);
  });

  it('ícones da aba declarados com o tamanho real (16 e 32) e o do iPhone 180 x 180 opaco', () => {
    expect(MARCA.iconesAba.map((i) => i.lado)).toEqual([16, 32]);
    for (const i of MARCA.iconesAba) expect(cabecalhoPng(doPublico(i.src))).toMatchObject({ largura: i.lado, altura: i.lado });
    expect(cabecalhoPng(doPublico(MARCA.apple.src))).toEqual({ largura: MARCA.apple.lado, altura: MARCA.apple.lado, cor: 2 });
  });

  it('o manifest lista o 192 e o 512, com nome Cronarca, e os arquivos batem com o tamanho declarado', () => {
    const m = manifest();
    expect(m.name).toBe('Cronarca');
    expect(m.short_name).toBe('Cronarca');
    expect(m.icons?.map((i) => i.sizes)).toEqual(['192x192', '512x512']);
    for (const i of m.icons ?? []) {
      const [l] = i.sizes!.split('x').map(Number);
      expect(cabecalhoPng(doPublico(i.src))).toMatchObject({ largura: l, altura: l });
    }
    // O 192 é opaco (fundo da arte): a tela inicial do Android não ganha borda estranha.
    expect(cabecalhoPng(doPublico(MARCA.iconesManifest[0].src)).cor).toBe(2);
  });
});

describe('marca: imagens das telas', () => {
  it('logo completa 546 x 192 em blocos de 6 x 6 (6 px do palco por pixel da arte)', () => {
    const buf = doPublico(MARCA.logo.src);
    expect(cabecalhoPng(buf)).toMatchObject({ largura: MARCA.logo.largura, altura: MARCA.logo.altura });
    expect(foraDaGrade(buf, 6)).toBe(0);
  });

  it('nome 448 x 80 em blocos de 8 x 8 (mostrado a 4x: metade exata)', () => {
    const buf = doPublico(MARCA.nome8x.src);
    expect(cabecalhoPng(buf)).toMatchObject({ largura: MARCA.nome8x.largura, altura: MARCA.nome8x.altura });
    expect(foraDaGrade(buf, 8)).toBe(0);
  });

  it('o selo existe em 16, 32, 64, 128, 256 e 512, e os múltiplos de 32 seguem a grade', () => {
    for (const lado of [16, 32, 64, 128, 256, 512] as const) {
      const buf = doPublico(MARCA.selo(lado));
      expect(cabecalhoPng(buf)).toMatchObject({ largura: lado, altura: lado });
      if (lado >= 32) expect(foraDaGrade(buf, lado / 32)).toBe(0);
    }
  });
});
