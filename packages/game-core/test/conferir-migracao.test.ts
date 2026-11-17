// Portão 20d-3: a verificação offline da migração 8 → 9 (scripts/lib/conferir-migracao.ts).
// Os saves são SINTÉTICOS (fixture gerada pelo código antigo, esquema 8); eles não
// substituem a conferência do dump real de produção.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conferirSave, conferirSaves, lerSaves, type Migrador, type SaveBruto } from '../../../scripts/lib/conferir-migracao.ts';
import { CLASSES_ANTIGAS } from '../data/aventureiros.ts';
import { carregarEstado, migrarEstado, VERSAO_ESQUEMA } from '../src/estado.ts';

const CAMINHO = new URL('./fixtures/sinteticos_v8.json', import.meta.url);
const { saves, sintetico } = lerSaves(readFileSync(CAMINHO, 'utf8'));
const porId = (id: string) => saves.find((s) => s.id === id)!;

/** Migrador com um defeito: roda o de verdade e mexe no resultado. */
const defeituoso = (mexer: (estado: any, versao: number) => void): Migrador => (bruto, versao) => {
  const r = migrarEstado(bruto, versao);
  mexer(r.estado as any, r.versao);
  return r;
};

describe('fixture sintética (código antigo, esquema 8)', () => {
  it('está marcada como sintética, sem dados reais, e cobre as 5 classes antigas, expedições em andamento e esquemas 6 a 8', () => {
    expect(sintetico).toBe(true);
    const bruto = readFileSync(CAMINHO, 'utf8');
    expect(JSON.parse(bruto).aviso).toMatch(/SINTÉTICOS/);
    expect(bruto).not.toMatch(/@/); // nenhum e-mail
    expect(saves.every((s) => s.id.startsWith('sint-'))).toBe(true);
    const classes = new Set(saves.flatMap((s) => ((s.estado as any).aventureiros as { classe: string }[]).map((a) => a.classe)));
    expect([...classes].sort()).toEqual(Object.keys(CLASSES_ANTIGAS).sort());
    expect(saves.some((s) => ((s.estado as any).expedicoes as unknown[]).length >= 2)).toBe(true);
    expect([...new Set(saves.map((s) => s.versao_esquema))].sort()).toEqual([6, 7, 8]);
  });
});

describe('conferirSaves com a migração de verdade', () => {
  it('todos os saves sintéticos migram sem perda; relatório com contagens e o aviso de sintético', () => {
    const r = conferirSaves(saves, { sintetico });
    expect(r.falhas.map((f) => [f.id, f.violacoes])).toEqual([]);
    expect(r.total).toBe(7);
    expect(r.ok).toBe(7);
    expect(r.texto).toMatch(/SAVES SINTÉTICOS/);
    expect(r.texto).toMatch(/Saves lidos: 7/);
    expect(r.texto).toMatch(/OK: 7 \| Falhas: 0/);
    expect(r.texto).toMatch(/ladino → arqueiro/);
    expect(r.texto).toMatch(/clerigo → cavaleiro/);
  });

  it('as conversões seguem o mapeamento decidido (guerreiro → Lanceiro, arqueiro e ladino → Arqueiro, clérigo → Cavaleiro, mago → Mago do Tempo)', () => {
    const r = conferirSave(porId('sint-02-cinco-classes'));
    expect(r.violacoes).toEqual([]);
    expect(r.conversoes).toEqual({
      'guerreiro → lanceiro': 1, 'arqueiro → arqueiro': 1, 'mago → mago_do_tempo': 1, 'ladino → arqueiro': 1, 'clerigo → cavaleiro': 1,
    });
  });

  it('save com expedição em andamento: o relatório da volta é o sorteado, igual com a classe antiga ou a nova', () => {
    const r = conferirSave(porId('sint-03-expedicoes-em-andamento'));
    expect(r.violacoes).toEqual([]);
    expect(r.expedicoes).toBe(2);
  });

  it('um save que já está no esquema 9 passa (idempotente) e as classes novas ficam como estão', () => {
    const migrado = migrarEstado(structuredClone(porId('sint-04-meio-de-jogo').estado), 8);
    const r = conferirSave({ id: 'sint-v9', versao_esquema: VERSAO_ESQUEMA, estado: migrado.estado });
    expect(r.violacoes).toEqual([]);
    expect(Object.keys(r.conversoes).every((k) => k.split(' → ')[0] === k.split(' → ')[1])).toBe(true);
  });
});

describe('a verificação pega uma migração defeituosa', () => {
  const base = () => porId('sint-02-cinco-classes');

  it('XP perdido', () => {
    const r = conferirSave(base(), defeituoso((e) => { e.aventureiros[1].xp = 0; }));
    expect(r.violacoes.join('\n')).toMatch(/campo xp mudou/);
  });

  it('nível, arma, armadura, nome, id e estado alterados', () => {
    for (const campo of ['nivel', 'arma', 'armadura', 'nome', 'estado', 'feridoAte'] as const) {
      const r = conferirSave(base(), defeituoso((e) => { e.aventureiros[3][campo] = campo === 'nome' ? 'Outro' : campo === 'estado' ? 'na_vila' : campo === 'feridoAte' ? null : 1; }));
      expect(r.violacoes.join('\n'), campo).toMatch(new RegExp(`campo ${campo} mudou`));
    }
  });

  it('mapeamento errado (clérigo virando Lanceiro)', () => {
    const r = conferirSave(base(), defeituoso((e) => { for (const a of e.aventureiros) if (a.classe === 'cavaleiro') a.classe = 'lanceiro'; }));
    expect(r.violacoes.join('\n')).toMatch(/clerigo virou lanceiro, esperado cavaleiro/);
  });

  it('classe antiga que sobra (o esquema 9 recusa)', () => {
    const r = conferirSave(base(), defeituoso((e) => { e.aventureiros[0].classe = 'guerreiro'; }));
    expect(r.violacoes.join('\n')).toMatch(/recusa o estado migrado/);
  });

  it('aventureiro perdido ou duplicado', () => {
    expect(conferirSave(base(), defeituoso((e) => { e.aventureiros.pop(); })).violacoes.join('\n')).toMatch(/aventureiros: 5 antes, 4 depois/);
    expect(conferirSave(base(), defeituoso((e) => { e.aventureiros[1].id = e.aventureiros[0].id; })).violacoes.join('\n')).toMatch(/ids de aventureiro repetidos|campo id mudou/);
  });

  it('recursos, construções, pesquisas, relíquias, ciclo e Falha alterados', () => {
    const casos: [string, (e: any) => void][] = [
      ['recursos', (e) => { e.recursos.madeira += 1; }],
      ['slots', (e) => { e.slots.casa_1.nivel += 1; }],
      ['pesquisas', (e) => { e.pesquisas.concluidas.push('cartografia'); }],
      ['reliquias', (e) => { e.reliquias.total += 1; }],
      ['ciclo', (e) => { e.ciclo += 1; }],
      ['falha', (e) => { e.falha = 4; }],
    ];
    for (const [campo, mexer] of casos) {
      const r = conferirSave(porId('sint-05-pos-ascensao'), defeituoso(mexer));
      expect(r.violacoes.join('\n'), campo).toMatch(new RegExp(`campo ${campo} mudou`));
    }
  });

  it('qualquer outro campo do save do esquema 8 mudado, ou campo novo', () => {
    expect(conferirSave(base(), defeituoso((e) => { e.t += 1; })).violacoes.join('\n')).toMatch(/save do esquema 8: campo t mudou/);
    expect(conferirSave(base(), defeituoso((e) => { e.extra = 1; })).violacoes.join('\n')).toMatch(/recusa o estado migrado|campo novo extra/);
  });

  it('save do esquema 9 (Portão 21): ganha o QG oculto desde o instante do save e mais nada muda', () => {
    const atual = carregarEstado(JSON.parse(JSON.stringify(porId('sint-05-pos-ascensao').estado)), porId('sint-05-pos-ascensao').versao_esquema);
    const { qg: _qg, ...sem } = { ...atual, versao: 9 };
    const v9: SaveBruto = { id: 'sint-v9', versao_esquema: 9, estado: JSON.parse(JSON.stringify(sem)) };
    expect(conferirSave(v9).violacoes).toEqual([]);
    // Um migrador que descobre o QG sem ninguém ter ido lá é pego.
    expect(conferirSave(v9, defeituoso((e) => { e.qg = { estado: 'ruinas', desde: e.t }; })).violacoes.join('\n')).toMatch(/qg depois da migração/);
    // E um que mexe em outro campo do save do esquema 9.
    expect(conferirSave(v9, defeituoso((e) => { e.recursos.madeira += 1; })).violacoes.join('\n')).toMatch(/campo recursos mudou/);
  });

  it('expedição em andamento que perde o resultado sorteado', () => {
    const r = conferirSave(porId('sint-03-expedicoes-em-andamento'), defeituoso((e) => { delete e.segredo.resultados[e.expedicoes[0].id]; }));
    expect(r.violacoes.join('\n')).toMatch(/sem resultado sorteado/);
  });

  it('migração que não é idempotente (mexe de novo ao migrar o que já está migrado)', () => {
    const r = conferirSave(porId('sint-01-conta-nova'), (bruto, versao) => {
      const m = migrarEstado(bruto, versao);
      if (versao === VERSAO_ESQUEMA) (m.estado as any).ciclo += 1;
      return m;
    });
    expect(r.violacoes.join('\n')).toMatch(/idempotente|carregar duas vezes/);
  });

  it('versão final errada e erro lançado na migração', () => {
    expect(conferirSave(base(), (bruto, versao) => ({ ...migrarEstado(bruto, versao), versao: 8 })).violacoes.join('\n')).toMatch(/versão final 8/);
    const r = conferirSave(base(), () => { throw new Error('quebrou'); });
    expect(r.violacoes).toEqual(['a migração lançou erro: quebrou']);
  });

  it('o relatório lista os saves que falharam, com o id', () => {
    const r = conferirSaves([base(), porId('sint-01-conta-nova')], { migrar: defeituoso((e) => { if (e.aventureiros.length === 5) e.aventureiros[0].xp = 99; }) });
    expect(r.ok).toBe(1);
    expect(r.falhas.map((f) => f.id)).toEqual(['sint-02-cinco-classes']);
    expect(r.texto).toMatch(/FALHOU save sint-02-cinco-classes \(v8\)/);
    expect(r.texto).toMatch(/OK: 1 \| Falhas: 1/);
  });
});

describe('lerSaves', () => {
  it('aceita o array do dump e o objeto { saves } da fixture; recusa formatos inválidos', () => {
    const um = JSON.stringify([{ id: 'x', versao_esquema: 8, estado: {} }]);
    expect(lerSaves(um)).toEqual({ saves: [{ id: 'x', versao_esquema: 8, estado: {} }], sintetico: false });
    expect(() => lerSaves('{"a":1}')).toThrow(/formato inesperado/);
    expect(() => lerSaves('[{"id":"x"}]')).toThrow(/sem id, versao_esquema ou estado/);
    expect(() => lerSaves('nao é json')).toThrow();
  });

  it('save com estado inválido vira falha no relatório, não exceção', () => {
    const lixo: SaveBruto = { id: 'lixo', versao_esquema: 8, estado: 'texto' };
    const r = conferirSaves([lixo, { id: 'lixo2', versao_esquema: 8, estado: { versao: 8 } }]);
    expect(r.falhas.map((f) => f.id)).toEqual(['lixo', 'lixo2']);
  });
});
