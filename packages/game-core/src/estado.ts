// Estado de um jogador (jsonb em GameState.estado). Esquema versionado.
// Unidades: recursos em micro-unidades, tempo em ms desde a época Unix.
import { z } from 'zod';
import { CLASSES, OFICIOS } from '../data/aventureiros.ts';
import { DESTINOS_IDS } from '../data/expedicoes.ts';
import { NIVEL_MAXIMO_CONSTRUCAO, TIPOS_CONSTRUCAO } from '../data/construcoes.ts';
import { PESQUISAS_IDS } from '../data/pesquisas.ts';
import { RECURSOS } from '../data/recursos.ts';
import { RELIQUIAS_IDS } from '../data/reliquias.ts';
import { SLOT_IDS, SLOTS, type SlotId } from '../data/slots.ts';
import { FORMULAS } from '../data/formulas.ts';
import { VERSOES_MAPA } from '../data/mapa.ts';

export const VERSAO_ESQUEMA = 4;

const inteiro = z.number().int();
const naoNegativo = inteiro.min(0);
const instante = naoNegativo;

const esquemaRecursos = z.strictObject(
  Object.fromEntries(RECURSOS.map((r) => [r, naoNegativo])) as Record<(typeof RECURSOS)[number], typeof naoNegativo>,
);

const esquemaSlot = z.strictObject({
  tipo: z.enum(TIPOS_CONSTRUCAO),
  nivel: inteiro.min(0).max(NIVEL_MAXIMO_CONSTRUCAO),
  /** Fim da obra em andamento (o nível sobe quando termina). */
  obraAte: instante.nullable(),
});

const esquemaSlots = z
  .strictObject(Object.fromEntries(SLOT_IDS.map((id) => [id, esquemaSlot])) as Record<SlotId, typeof esquemaSlot>)
  .superRefine((slots, ctx) => {
    for (const id of SLOT_IDS) {
      if (slots[id].tipo !== SLOTS[id].tipo) {
        ctx.addIssue({ code: 'custom', path: [id, 'tipo'], message: `slot ${id} é do tipo ${SLOTS[id].tipo}` });
      }
      if (slots[id].obraAte !== null && slots[id].nivel >= NIVEL_MAXIMO_CONSTRUCAO) {
        ctx.addIssue({ code: 'custom', path: [id, 'obraAte'], message: 'obra acima do nível máximo' });
      }
    }
  });

const esquemaAventureiro = z.strictObject({
  id: z.string().min(1),
  nome: z.string().min(1),
  classe: z.enum(CLASSES),
  nivel: inteiro.min(1).max(FORMULAS.aventureiro.nivelMaximo),
  xp: naoNegativo,
  arma: inteiro.min(0).max(FORMULAS.aventureiro.equipamentoMaximo),
  armadura: inteiro.min(0).max(FORMULAS.aventureiro.equipamentoMaximo),
  estado: z.enum(['na_vila', 'em_expedicao', 'ferido']),
  feridoAte: instante.nullable(),
});

const esquemaExpedicao = z.strictObject({
  id: z.string().min(1),
  destino: z.enum(DESTINOS_IDS),
  grupo: z.array(z.string().min(1)).min(1).max(3),
  inicio: instante,
  fim: instante,
});

const esquemaResultado = z.strictObject({
  vitoria: z.boolean(),
  saque: z.partialRecord(z.enum(RECURSOS), naoNegativo),
  feridos: z.array(z.string()),
});

const esquemaBalde = z.strictObject({ fichas: naoNegativo, em: instante });

/** Resultado de uma expedição que voltou (aba Expedições, "Relatórios"). Nomes guardados como eram na volta. */
const esquemaRelatorio = z.strictObject({
  destino: z.enum(DESTINOS_IDS),
  grupo: z.array(z.string().min(1)).min(1).max(3),
  vitoria: z.boolean(),
  /** O que de fato entrou (já cortado no teto), em milionésimos. */
  saque: z.partialRecord(z.enum(RECURSOS), naoNegativo),
  feridos: z.array(z.string()),
  em: instante,
});

export const esquemaEstado = z
  .strictObject({
    versao: z.literal(VERSAO_ESQUEMA),
    era: inteiro.min(1).max(4),
    ciclo: inteiro.min(1),
    /** Mapa fixo (A13): só a versão, para trocar o mapa no futuro sem quebrar saves. */
    mundo: z.strictObject({
      versaoMapa: z.union(VERSOES_MAPA.map((v) => z.literal(v)) as unknown as [z.ZodLiteral<1>, z.ZodLiteral<2>]),
    }),
    /** Instante até onde a simulação foi liquidada. */
    t: instante,
    recursos: esquemaRecursos,
    slots: esquemaSlots,
    aldeoes: z.array(z.strictObject({ oficio: z.enum(OFICIOS) })),
    /** Tempo acumulado para o próximo aldeão chegar (só conta com vaga e comida). */
    progressoAldeaoMs: naoNegativo,
    aventureiros: z.array(esquemaAventureiro),
    /** Contratações feitas neste ciclo (o aventureiro inicial não conta). */
    contratacoes: naoNegativo,
    /** Contador para ids de aventureiros e expedições. */
    proximoId: naoNegativo,
    expedicoes: z.array(esquemaExpedicao),
    pesquisas: z.strictObject({
      concluidas: z.array(z.enum(PESQUISAS_IDS)),
      atual: z.strictObject({ id: z.enum(PESQUISAS_IDS), fim: instante }).nullable(),
    }),
    objetivos: z.strictObject({ criptaVencida: z.boolean() }),
    /** Mercador Viajante esperando resposta. */
    mercador: z.strictObject({ expiraEm: instante }).nullable(),
    reliquias: z.strictObject({
      total: naoNegativo,
      gastas: naoNegativo,
      niveis: z.partialRecord(z.enum(RELIQUIAS_IDS), naoNegativo),
    }),
    /** Baldes de fichas do clique (fichas em milésimos), no relógio do servidor. */
    cliques: z.strictObject({ usuario: esquemaBalde, objetos: z.record(z.string(), esquemaBalde) }),
    cronica: z.array(z.strictObject({ icone: z.string(), texto: z.string(), em: instante })),
    /** Esquema 3: as últimas expedições que voltaram. */
    relatorios: z.array(esquemaRelatorio),
    /** Só do servidor: nunca vai para o cliente (ver visaoDoCliente). */
    segredo: z.strictObject({
      rng: inteiro.min(0).max(0xffffffff),
      proximoEventoEm: instante,
      resultados: z.record(z.string(), esquemaResultado),
    }),
  })
  .superRefine((e, ctx) => {
    if (e.reliquias.gastas > e.reliquias.total) {
      ctx.addIssue({ code: 'custom', path: ['reliquias', 'gastas'], message: 'gastou mais do que tem' });
    }
  });

export type EstadoJogo = z.infer<typeof esquemaEstado>;
export type Aventureiro = EstadoJogo['aventureiros'][number];
export type Expedicao = EstadoJogo['expedicoes'][number];
export type ResultadoExpedicao = z.infer<typeof esquemaResultado>;
export type LinhaCronica = EstadoJogo['cronica'][number];

/** O que o cliente pode ver: tudo menos o segredo (sorteios já feitos e o gerador). */
export type VisaoCliente = Omit<EstadoJogo, 'segredo'>;

export function visaoDoCliente(estado: EstadoJogo): VisaoCliente {
  const { segredo: _segredo, ...visivel } = estado;
  return structuredClone(visivel);
}

/**
 * Atualiza um estado gravado numa versão anterior do esquema, um passo por
 * vez. 2 -> 3: entra a lista de relatórios de expedição (começa vazia).
 */
export function migrarEstado(bruto: unknown, versaoEsquema: number): { estado: unknown; versao: number } {
  let estado = bruto as Record<string, unknown>;
  let versao = versaoEsquema;
  if (versao === 2) {
    estado = { ...estado, versao: 3, relatorios: [] };
    versao = 3;
  }
  if (versao === 3) {
    // A13: o mundo por semente sai; todos passam ao mapa fixo da versão 1.
    estado = { ...estado, versao: 4, mundo: { versaoMapa: 1 } };
    versao = 4;
  }
  return { estado, versao };
}

/** Lê um estado do banco em qualquer versão conhecida: migra e valida na versão atual. */
export function carregarEstado(bruto: unknown, versaoEsquema: number): EstadoJogo {
  const m = migrarEstado(bruto, versaoEsquema);
  return validarEstado(m.estado, m.versao);
}

/**
 * Valida um estado vindo do banco. A11: GameState.versaoEsquema é a
 * referência; estado.versao é espelho e precisa ser igual.
 */
export function validarEstado(bruto: unknown, versaoEsquema: number = VERSAO_ESQUEMA): EstadoJogo {
  const estado = esquemaEstado.parse(bruto);
  if (estado.versao !== versaoEsquema) {
    throw new Error(`estado.versao (${estado.versao}) diverge de versaoEsquema (${versaoEsquema})`);
  }
  return estado;
}
