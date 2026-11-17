// Portão Animação: todo quadro do quadros.json existe em public/sprites/<grupo>/,
// com o tamanho declarado, e as telas só usam sprites que estão no catálogo.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANIMACOES, QUADROS, QUADROS_CENA, todosOsQuadros } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { arquivoDoSprite, lerPng, PASTA_PUBLICA, ultimaLinhaOpaca } from './png';

describe('quadros.json e os arquivos', () => {
  it('todo quadro existe, com o tamanho do campo tamanho', () => {
    for (const a of ANIMACOES.values()) {
      for (const q of a.quadros) {
        expect(existsSync(arquivoDoSprite(q)), q).toBe(true);
        const b = readFileSync(arquivoDoSprite(q));
        expect({ largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) }, q).toEqual({ largura: a.tamanho, altura: a.tamanho });
      }
    }
    expect(todosOsQuadros()).toHaveLength(206); // Portão 21: +10 (quartel e ruínas); Portão 22: +18 das classes novas, −24 das antigas
  });

  it('o pé (última linha opaca) é o mesmo em todos os quadros; só o impacto do lenhador e do mineiro desce 1 px', () => {
    for (const [grupo, sprites] of Object.entries({ ...QUADROS, ...QUADROS_CENA })) {
      if (!['aldeao', 'aventureiro', 'construcao', 'cenario', 'cena'].includes(grupo)) continue;
      for (const nome of Object.keys(sprites)) {
        const a = ANIMACOES.get(`${grupo}/${nome}`)!;
        const pe1 = ultimaLinhaOpaca(lerPng(a.quadros[0]!));
        a.quadros.forEach((q, k) => {
          const desce = grupo === 'aldeao' && ['lenhador', 'mineiro'].includes(nome) && k === 2 ? 1 : 0;
          expect(ultimaLinhaOpaca(lerPng(q)), q).toBe(pe1 + desce);
        });
      }
    }
  });

  it('sem sombra embutida: abaixo do pé dos sprites com sombra L3b não há pixel semitransparente', () => {
    for (const grupo of ['construcao', 'cenario']) {
      for (const nome of Object.keys(QUADROS[grupo]!)) {
        for (const q of ANIMACOES.get(`${grupo}/${nome}`)!.quadros) {
          const img = lerPng(q);
          const pe = ultimaLinhaOpaca(img);
          for (let y = pe + 1; y < img.altura; y++) {
            for (let x = 0; x < img.largura; x++) expect(img.dados[(y * img.largura + x) * 4 + 3], `${q} (${x}, ${y})`).toBe(0);
          }
        }
      }
    }
  });

  it('os PNGs antigos substituídos saíram de public/mapa e public/casca', () => {
    for (const velho of ['mapa/construcao-casa-1.png', 'mapa/aldeao-lenhador-1.png', 'mapa/aventureiro-mago-2.png', 'mapa/poco-1.png', 'mapa/cerca-1.png', 'casca/evento-mercador-1.png', 'casca/destino-mina.png']) {
      expect(existsSync(join(PASTA_PUBLICA, velho)), velho).toBe(false);
    }
  });
});
