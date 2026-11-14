import { MAPA } from '@cronarca/game-core';
import { describe, expect, it } from 'vitest';
import { deslocamento, limitarCamera, type Camera } from '../lib/mapa/camera';
import { estadoDeExemplo } from '../lib/mapa/exemplo';
import { intersecta, layoutL7, MEDIDAS, type Medidor, type Ret, type Tela } from '../lib/mapa/layoutMarcadores';
import { marcadores, type Marcadores } from '../lib/mapa/marcadores';
import { caixaDoAviso, nevoasAtivas } from '../lib/mapa/nevoa';
import { areaDoMapa, VIEWPORT_DESKTOP as VP, VISOES } from '../lib/mapa/visoes';

const m = MAPA;
const T0 = 1_800_000_000_000;
const AGORA = T0 + 7_000;

// Medidor aproximado (as fontes reais não existem no Node): px por caractere, folgado para cima.
const medir: Medidor = (texto, tipo) =>
  Math.ceil(texto.length * { rotulo: 7, tempo: 8, aviso: 12, avisoLonge: 9 }[tipo]);

const area = areaDoMapa();

/** Caixa do aviso: o quadrado inscrito na névoa da Cripta (Portão 9). */
const nevoa = nevoasAtivas(estadoDeExemplo(T0)).find((n) => n.destino === 'cripta')!;
const CAIXA_CRIPTA = caixaDoAviso(nevoa);
const caixaCriptaNaTela = (t: Tela): Ret => {
  const x = Math.round(CAIXA_CRIPTA.x * t.zoom + t.dx);
  const y = Math.round(CAIXA_CRIPTA.y * t.zoom + t.dy);
  return { x, y, largura: CAIXA_CRIPTA.largura * t.zoom, altura: CAIXA_CRIPTA.altura * t.zoom };
};
/** Sem a névoa (Estradas Reais concluída): o mesmo estado sem o aviso. */
const semAviso = (mk: Marcadores): Marcadores => ({ ...mk, avisoNevoa: null });

/** Câmeras: visão Mapa, centro da imagem, e uma centrada em cada destino (o pior caso de aperto). */
function cameras(zoom: number): Camera[] {
  const centros = [
    { x: VISOES.mapa.x, y: VISOES.mapa.y },
    { x: area.x + area.largura / 2, y: area.y + area.altura / 2 },
    ...m.destinos.map((d) => ({ x: d.x, y: d.y })),
  ];
  return centros.map((c) => limitarCamera({ ...c, zoom }, area, VP));
}

describe('colisão da L7: pin > rótulo > caixa de tempo > aviso', () => {
  const vp: Ret = { x: 0, y: 0, largura: VP.largura, altura: VP.altura };

  for (const zoom of [1, 2, 3]) {
    it(`zoom ${zoom}x: nenhum item de prioridade menor cobre um de prioridade igual ou maior`, () => {
      let casos = 0;
      // Com o aviso (Cripta sob névoa) e sem ele (Estradas Reais concluída).
      for (const mk of [marcadores(m, estadoDeExemplo(T0), AGORA), semAviso(marcadores(m, estadoDeExemplo(T0), AGORA))]) {
        for (const cam of cameras(zoom)) {
          const d = deslocamento(cam, VP);
          const tela = { dx: d.x, dy: d.y, zoom };
          const cripta = caixaCriptaNaTela(tela);
          const L = layoutL7(mk, tela, medir, { viewport: VP, caixaCripta: cripta });
          casos++;
          const ctx = `aviso ${mk.avisoNevoa ? 'sim' : 'não'}, câmera (${cam.x}, ${cam.y})`;

          const pins = L.pins.map((p) => p.ret);
          const rotulos = L.rotulos.map((r) => r.ret);
          const caixas = L.caixas.map((c) => c.ret);

          // Rótulo só a partir de 1,5x.
          if (zoom < MEDIDAS.zoomMinimoRotulo) expect(rotulos, ctx).toHaveLength(0);
          else expect(rotulos.length, `${ctx}: todo pin visível ganha rótulo`).toBe(pins.length);

          for (const r of rotulos) {
            expect(pins.some((p) => intersecta(r, p)), `${ctx}: rótulo sobre pin`).toBe(false);
            expect(r.x >= 0 && r.y >= 0 && r.x + r.largura <= vp.largura && r.y + r.altura <= vp.altura, `${ctx}: rótulo fora da tela`).toBe(true);
          }
          for (let a = 0; a < rotulos.length; a++) for (let b = a + 1; b < rotulos.length; b++) expect(intersecta(rotulos[a]!, rotulos[b]!), `${ctx}: rótulos`).toBe(false);

          for (const c of caixas) {
            expect([...pins, ...rotulos].some((o) => intersecta(c, o)), `${ctx}: caixa sobre pin ou rótulo`).toBe(false);
            expect(c.x >= 0 && c.y >= 0 && c.x + c.largura <= vp.largura && c.y + c.altura <= vp.altura, `${ctx}: caixa fora da tela`).toBe(true);
          }
          for (let a = 0; a < caixas.length; a++) for (let b = a + 1; b < caixas.length; b++) expect(intersecta(caixas[a]!, caixas[b]!), `${ctx}: caixas`).toBe(false);

          if (L.aviso) {
            const r = L.aviso.ret;
            expect([...pins, ...rotulos, ...caixas].some((o) => intersecta(r, o)), `${ctx}: aviso sobre outro item`).toBe(false);
            expect(r.x >= cripta.x && r.y >= cripta.y && r.x + r.largura <= cripta.x + cripta.largura && r.y + r.altura <= cripta.y + cripta.altura, `${ctx}: aviso fora da caixa da cripta`).toBe(true);
            expect(r.x >= 0 && r.y >= 0 && r.x + r.largura <= vp.largura && r.y + r.altura <= vp.altura, `${ctx}: aviso fora da tela`).toBe(true);
            expect(L.aviso.fonte).toBe(zoom < MEDIDAS.zoomMinimoRotulo ? MEDIDAS.avisoFonteLonge : MEDIDAS.avisoFonte);
          }
        }
      }
      expect(casos).toBe(2 * (2 + m.destinos.length));
    });
  }

  it('o aviso fica no ponto livre da caixa mais longe do pin e do rótulo da Cripta', () => {
    const mk = marcadores(m, estadoDeExemplo(T0), AGORA);
    const cam = limitarCamera({ x: CAIXA_CRIPTA.x + 64, y: CAIXA_CRIPTA.y + 48, zoom: 2 }, area, VP);
    const d = deslocamento(cam, VP);
    const tela = { dx: d.x, dy: d.y, zoom: 2 };
    const L = layoutL7(mk, tela, medir, { viewport: VP, caixaCripta: caixaCriptaNaTela(tela) });
    expect(L.aviso).not.toBeNull();
    const pin = L.pins.find((p) => p.pin.id === 'cripta')!.ret;
    const centro = (r: Ret) => ({ x: r.x + r.largura / 2, y: r.y + r.altura / 2 });
    const dist = Math.hypot(centro(L.aviso!.ret).x - centro(pin).x, centro(L.aviso!.ret).y - centro(pin).y);
    // Qualquer outra posição na parte visível da caixa não fica mais longe que a escolhida (a menos de um passo).
    const inteira = caixaCriptaNaTela(tela);
    const x0 = Math.max(inteira.x, 0);
    const y0 = Math.max(inteira.y, 0);
    const cx = { x: x0, y: y0, largura: Math.min(inteira.x + inteira.largura, VP.largura) - x0, altura: Math.min(inteira.y + inteira.altura, VP.altura) - y0 };
    const cantos = [
      { x: cx.x, y: cx.y }, { x: cx.x + cx.largura - L.aviso!.ret.largura, y: cx.y },
      { x: cx.x, y: cx.y + cx.altura - L.aviso!.ret.altura }, { x: cx.x + cx.largura - L.aviso!.ret.largura, y: cx.y + cx.altura - L.aviso!.ret.altura },
    ];
    for (const c of cantos) {
      const r = { ...L.aviso!.ret, ...c };
      const livre = ![...L.pins.map((p) => p.ret), ...L.rotulos.map((x) => x.ret), ...L.caixas.map((x) => x.ret)].some((o) => intersecta(r, o));
      if (livre) expect(dist + MEDIDAS.passoBusca * 2).toBeGreaterThanOrEqual(Math.hypot(centro(r).x - centro(pin).x, centro(r).y - centro(pin).y));
    }
  });
});

describe('grupo em marcha: tamanho fixo na tela', () => {
  it('sprite de 32 px de tela em 1x, 2x, 3x e 4x; abaixo do zoom 2 é o ícone de 16 px; apoiado pelo pé; caixa de tempo fixa', () => {
    const e = estadoDeExemplo(T0);
    const mk = marcadores(m, e, AGORA);
    expect(mk.grupos.length).toBeGreaterThan(0);
    const alturasCaixa = new Set<number>();
    for (const zoom of [1, 2, 3, 4]) {
      const g0 = mk.grupos[0]!;
      const cam = { x: g0.pe.x, y: g0.pe.y, zoom };
      const d = deslocamento(cam, VP);
      const t = { dx: d.x, dy: d.y, zoom };
      const L = layoutL7(mk, t, medir, { viewport: VP, caixaCripta: null });
      const g = L.grupos[0]!;
      const icone = zoom < MEDIDAS.zoomMinimoAventureiro;
      expect(g.icone, `${zoom}x`).toBe(icone);
      // Retângulo do sprite na tela: sempre 32 (aventureiro); 16 no ícone, abaixo do zoom 2.
      expect(g.lado, `${zoom}x`).toBe(icone ? MEDIDAS.icone : MEDIDAS.aventureiro);
      if (!icone) expect(g.lado).toBe(32);
      const pe = { x: Math.round(g0.pe.x * zoom + d.x), y: Math.round(g0.pe.y * zoom + d.y) };
      expect(g.x + g.lado / 2).toBe(pe.x);
      expect(g.y + Math.round(g.lado * 0.9)).toBe(pe.y);
      expect(Number.isInteger(g.x) && Number.isInteger(g.y)).toBe(true);
      for (const c of L.caixas) alturasCaixa.add(c.ret.altura);
      // A caixa do grupo (a 1ª pedida) fica acima dele.
      const caixa = L.caixas[0]!;
      expect(caixa.ret.y + caixa.ret.altura, `${zoom}x`).toBeLessThanOrEqual(g.y);
    }
    expect([...alturasCaixa]).toEqual([MEDIDAS.tempoAltura]);
  });
});
