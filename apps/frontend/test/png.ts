// Leitor mínimo de PNG para os testes (RGBA 8 bits, sem entrelaçamento),
// só com zlib: lê os sprites reais de public/mapa.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import type { ImagemRgba } from '../lib/mapa/sombras';

export const PASTA_MAPA = join(__dirname, '..', 'public', 'mapa');
export const PASTA_PUBLICA = join(__dirname, '..', 'public');

/** Um nome solto é public/mapa/<nome>.png; um endereço (/sprites/...) é o arquivo em public. */
export const arquivoDoSprite = (nome: string) => (nome.startsWith('/') ? join(PASTA_PUBLICA, nome) : join(PASTA_MAPA, `${nome}.png`));

export function lerPng(nome: string): ImagemRgba {
  return decodificarPng(readFileSync(arquivoDoSprite(nome)), nome);
}

/** PNG de 8 bits sem entrelaçamento: RGBA (6), RGB (2) ou paleta (3, com tRNS). Sai sempre em RGBA. */
export function decodificarPng(buf: Buffer, nome = 'png'): ImagemRgba {
  let p = 8;
  let largura = 0;
  let altura = 0;
  let tipoCor = 6;
  let paleta: Buffer | null = null;
  let alfas: Buffer | null = null;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const n = buf.readUInt32BE(p);
    const tipo = buf.toString('ascii', p + 4, p + 8);
    const dados = buf.subarray(p + 8, p + 8 + n);
    if (tipo === 'IHDR') {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      tipoCor = dados[9]!;
      if (dados[8] !== 8 || ![2, 3, 6].includes(tipoCor) || dados[12] !== 0) throw new Error(`${nome}: esperado RGBA, RGB ou paleta de 8 bits, sem entrelaçamento`);
    } else if (tipo === 'PLTE') paleta = dados;
    else if (tipo === 'tRNS') alfas = dados;
    else if (tipo === 'IDAT') idat.push(dados);
    p += 12 + n;
  }
  const bpp = tipoCor === 6 ? 4 : tipoCor === 2 ? 3 : 1;
  const bruto = inflateSync(Buffer.concat(idat));
  const linha = largura * bpp;
  const lin = new Uint8Array(linha * altura);
  for (let y = 0; y < altura; y++) {
    const f = bruto[y * (linha + 1)]!;
    for (let i = 0; i < linha; i++) {
      const a = i >= bpp ? lin[y * linha + i - bpp]! : 0;
      const b = y > 0 ? lin[(y - 1) * linha + i]! : 0;
      const c = i >= bpp && y > 0 ? lin[(y - 1) * linha + i - bpp]! : 0;
      let v = bruto[y * (linha + 1) + 1 + i]!;
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      lin[y * linha + i] = v & 255;
    }
  }
  if (tipoCor === 6) return { largura, altura, dados: new Uint8ClampedArray(lin.buffer) };
  const px = new Uint8ClampedArray(largura * altura * 4);
  for (let k = 0; k < largura * altura; k++) {
    if (tipoCor === 2) {
      px.set([lin[k * 3]!, lin[k * 3 + 1]!, lin[k * 3 + 2]!, 255], k * 4);
    } else {
      const i = lin[k]!;
      px.set([paleta![i * 3]!, paleta![i * 3 + 1]!, paleta![i * 3 + 2]!, alfas && i < alfas.length ? alfas[i]! : 255], k * 4);
    }
  }
  return { largura, altura, dados: px };
}

/** Última linha com algum pixel de alfa 255 (-1 se não houver). */
export function ultimaLinhaOpaca(img: ImagemRgba): number {
  for (let y = img.altura - 1; y >= 0; y--) {
    for (let x = 0; x < img.largura; x++) if (img.dados[(y * img.largura + x) * 4 + 3] === 255) return y;
  }
  return -1;
}
