import { describe, expect, it } from 'vitest';
import { aplicarAcao, type Acao } from '../src/acoes.ts';
import { visaoDoCliente } from '../src/estado.ts';
import { liquidar } from '../src/liquidar.ts';
import { preverAcao, preverEstado, precisaDoServidor } from '../src/previsao.ts';
import { comRecursos, fazer, MIN, novo, SEG, T0 } from './ajuda.ts';

/** Um estado com produção, obra e pesquisa em andamento, sem eventos no intervalo. */
function emAndamento() {
  const rico = novo();
  rico.slots.armazem_1.nivel = 3; // teto 675 (o inicial, 300, não cabe a obra)
  let e = comRecursos(rico, { madeira: 600, pedra: 600, ferro: 300, saber: 250, ouro: 100 });
  e = fazer(e, { tipo: 'melhorar', slot: 'serraria_1' });
  e = fazer(e, { tipo: 'construir', slot: 'pedreira_1' }, T0 + 5 * SEG);
  e = fazer(e, { tipo: 'pesquisar', pesquisa: 'cartografia' }, T0 + 6 * SEG);
  return e;
}

describe('previsão no cliente', () => {
  it('sem evento nem expedição, a previsão é igual à liquidação do servidor (em vários alvos)', () => {
    const e = emAndamento();
    for (const dt of [1, 999, 7 * SEG, 3 * MIN, 47 * MIN, 5 * 60 * MIN]) {
      const servidor = visaoDoCliente(liquidar(e, T0 + dt));
      const cliente = preverEstado(visaoDoCliente(e), T0 + dt);
      expect(cliente.estado, `dt ${dt}`).toEqual(servidor);
      expect(cliente.paradaEm).toBeNull();
    }
  });

  it('prever em um passo ou em muitos passos dá o mesmo resultado', () => {
    const v = visaoDoCliente(emAndamento());
    const umPasso = preverEstado(v, T0 + 20 * MIN).estado;
    let aos = v;
    for (let k = 1; k <= 40; k++) aos = preverEstado(aos, T0 + k * 30 * SEG).estado;
    expect(aos).toEqual(umPasso);
  });

  it('para antes do fim de uma expedição (resultado secreto) e diz quando pedir o estado', () => {
    const e = fazer(novo(), { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: [novo().aventureiros[0]!.id] });
    const fim = e.expedicoes[0]!.fim;
    const p = preverEstado(visaoDoCliente(e), fim + 60 * SEG);
    expect(p.paradaEm).toBe(fim);
    expect(p.estado.t).toBe(fim - 1);
    expect(p.estado.expedicoes).toHaveLength(1); // a volta só vem do servidor
    expect(preverEstado(visaoDoCliente(e), fim - 10 * SEG).paradaEm).toBeNull();
  });

  it('não aplica eventos: a hora do próximo é secreta', () => {
    const e = novo({ semEventos: false });
    const evento = e.segredo.proximoEventoEm;
    const p = preverEstado(visaoDoCliente(e), evento + 10 * MIN).estado;
    expect(p.cronica.length).toBe(visaoDoCliente(e).cronica.length);
  });

  it('ação sem sorteio: a prevista é igual à do servidor', () => {
    const e = emAndamento();
    const agora = T0 + 2 * MIN;
    for (const acao of [{ tipo: 'clicar', objeto: 'arvore_1', quantidade: 3 }, { tipo: 'melhorar', slot: 'casa_1' }, { tipo: 'construir', slot: 'forja_1' }] as const) {
      const opcoes = { objetosDoMapa: { arvore_1: 'madeira' as const } };
      const servidor = aplicarAcao(e, acao, agora, opcoes);
      const cliente = preverAcao(visaoDoCliente(e), acao, agora, opcoes);
      expect(cliente.ok).toBe(servidor.ok);
      expect(cliente.estado).toEqual(visaoDoCliente(servidor.estado));
    }
  });

  it('ação recusada no servidor é recusada na previsão, com o mesmo erro', () => {
    const e = comRecursos(novo(), { madeira: 0, pedra: 0 });
    const r = preverAcao(visaoDoCliente(e), { tipo: 'construir', slot: 'forja_1' }, T0);
    const s = aplicarAcao(e, { tipo: 'construir', slot: 'forja_1' }, T0);
    expect(r.ok).toBe(false);
    expect(!r.ok && !s.ok && r.erro === s.erro).toBe(true);
  });

  it('contratar, partir em expedição e ascender esperam o servidor (sorteiam) e não mudam nada', () => {
    const v = visaoDoCliente(novo());
    const acoes: Acao[] = [{ tipo: 'contratar' }, { tipo: 'ascender' }, { tipo: 'partir_expedicao', destino: 'floresta_lobos', grupo: [v.aventureiros[0]!.id] }];
    for (const acao of acoes) {
      expect(precisaDoServidor(acao)).toBe(true);
      const r = preverAcao(v, acao, T0);
      expect(r).toEqual({ ok: false, erro: 'espera_servidor', estado: v });
    }
    expect(precisaDoServidor({ tipo: 'clicar', objeto: 'arvore_1', quantidade: 1 })).toBe(false);
  });
});
