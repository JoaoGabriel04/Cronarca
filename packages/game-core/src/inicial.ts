import { CLASSE_INICIAL, NOMES_AVENTUREIROS } from '../data/aventureiros.ts';
import { ESTADO_INICIAL_CICLO } from '../data/eras.ts';
import { INTERVALO_EVENTOS_MIN } from '../data/eventos.ts';
import { FORMULAS } from '../data/formulas.ts';
import { VERSAO_MAPA_ATUAL } from '../data/mapa.ts';
import { RECURSOS } from '../data/recursos.ts';
import { SLOT_IDS, SLOTS, type SlotId } from '../data/slots.ts';
import { CONFIG_ALDEOES_INICIAL } from '../data/aldeoes.ts';
import { registrar } from './cronica.ts';
import { VERSAO_ESQUEMA, type EstadoJogo } from './estado.ts';
import { micro } from './inteiros.ts';
import { tetos } from './regras.ts';
import { criarSorteador, type Sorteador } from './rng.ts';

export interface OpcoesInicio {
  /** Semente do gerador (uint32), sorteada pelo servidor. */
  semente: number;
  /** Instante de início, em ms. */
  agora: number;
  ciclo?: number;
  /** Relíquias que sobrevivem à ascensão. */
  reliquias?: EstadoJogo['reliquias'];
  cronica?: EstadoJogo['cronica'];
}

export function sortearIntervaloEventoMs(s: Sorteador): number {
  const [min, max] = INTERVALO_EVENTOS_MIN;
  return s.inteiro(min * 60_000, max * 60_000);
}

/** Nome da lista fixa, evitando repetir enquanto houver nome livre. */
export function sortearNome(s: Sorteador, usados: readonly string[]): string {
  const livres = NOMES_AVENTUREIROS.filter((n) => !usados.includes(n));
  return s.escolher(livres.length > 0 ? livres : NOMES_AVENTUREIROS);
}

/** Estado do início de um ciclo (também o estado depois de ascender). */
export function estadoInicial(op: OpcoesInicio): EstadoJogo {
  const s = criarSorteador(op.semente);
  const ciclo = op.ciclo ?? 1;
  const reliquias = structuredClone(op.reliquias ?? { total: 0, gastas: 0, niveis: {} });
  const legado = reliquias.niveis.legado ?? 0;
  const linhagem = reliquias.niveis.linhagem_heroica ?? 0;

  const slots = Object.fromEntries(
    SLOT_IDS.map((id) => [
      id,
      { tipo: SLOTS[id].tipo, nivel: (ESTADO_INICIAL_CICLO.slotsProntos as readonly SlotId[]).includes(id) ? 1 : 0, obraAte: null },
    ]),
  ) as EstadoJogo['slots'];

  const e: EstadoJogo = {
    versao: VERSAO_ESQUEMA,
    era: 1,
    ciclo,
    mundo: { versaoMapa: VERSAO_MAPA_ATUAL },
    t: op.agora,
    recursos: { madeira: 0, pedra: 0, comida: 0, ferro: 0, ouro: 0, saber: 0 },
    slots,
    aldeoes: ESTADO_INICIAL_CICLO.aldeoes.map((oficio) => ({ oficio })),
    aldeoesConfig: { ...CONFIG_ALDEOES_INICIAL },
    progressoAldeaoMs: 0,
    aventureiros: [],
    contratacoes: 0,
    proximoId: 1,
    expedicoes: [],
    pesquisas: { concluidas: [], atual: null },
    objetivos: { criptaVencida: false },
    mercador: null,
    reliquias,
    cliques: { usuario: { fichas: FORMULAS.clique.porSegundoUsuario * 1000, em: op.agora }, objetos: {} },
    cronica: structuredClone(op.cronica ?? []),
    relatorios: [],
    segredo: { rng: 0, proximoEventoEm: 0, resultados: {} },
  };

  // Recursos iniciais + Legado, cortados no teto como todo recurso que entra.
  const teto = tetos(e);
  const bonusLegado = FORMULAS.reliquias.legadoPorNivel as Partial<Record<(typeof RECURSOS)[number], number>>;
  for (const r of RECURSOS) {
    const valor = micro(ESTADO_INICIAL_CICLO.recursos[r]) + micro(bonusLegado[r] ?? 0) * legado;
    e.recursos[r] = Math.min(valor, teto[r]);
  }

  for (let i = 0; i < ESTADO_INICIAL_CICLO.aventureiros; i++) {
    e.aventureiros.push({
      id: `a${e.proximoId++}`,
      nome: sortearNome(s, e.aventureiros.map((a) => a.nome)),
      classe: CLASSE_INICIAL,
      nivel: FORMULAS.aventureiro.nivelInicial + FORMULAS.reliquias.linhagemHeroicaPorNivel * linhagem,
      xp: 0,
      arma: 0,
      armadura: 0,
      estado: 'na_vila',
      feridoAte: null,
    });
  }

  e.segredo.proximoEventoEm = op.agora + sortearIntervaloEventoMs(s);
  e.segredo.rng = s.estado;
  registrar(e, 'Check', ciclo === 1 ? 'Uma fogueira acesa. Começa a crônica da aldeia.' : `Começa o ciclo ${ciclo}.`, op.agora);
  return e;
}
