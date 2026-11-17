// Estado de um jogador (jsonb em GameState.estado). Esquema versionado.
// Unidades: recursos em micro-unidades, tempo em ms desde a época Unix.
import { z } from 'zod';
import { FALHA } from '../data/falha.ts';
import { CAPITULOS_IDS } from '../data/lore.ts';
import { diarioDaMigracao } from './diario.ts';
import { CONFIG_ALDEOES_INICIAL, OFICIOS_ALDEAO, POLITICAS_ALDEOES } from '../data/aldeoes.ts';
import { CLASSES, CLASSES_ANTIGAS, OFICIOS } from '../data/aventureiros.ts';
import { DESTINOS_IDS } from '../data/expedicoes.ts';
import { QG, QG_ESTADOS } from '../data/qg.ts';
import { NIVEL_MAXIMO_CONSTRUCAO, TIPOS_CONSTRUCAO } from '../data/construcoes.ts';
import { PESQUISAS_IDS } from '../data/pesquisas.ts';
import { RECURSOS } from '../data/recursos.ts';
import { RELIQUIAS_IDS } from '../data/reliquias.ts';
import { SLOT_IDS, SLOTS, type SlotId } from '../data/slots.ts';
import { FORMULAS } from '../data/formulas.ts';
import { VERSOES_MAPA } from '../data/mapa.ts';
import { termosDoMercador } from './mercador.ts';

export const VERSAO_ESQUEMA = 11;

const inteiro = z.number().int();
const naoNegativo = inteiro.min(0);
const instante = naoNegativo;

const esquemaRecursos = z.strictObject(
  Object.fromEntries(RECURSOS.map((r) => [r, naoNegativo])) as Record<(typeof RECURSOS)[number], typeof naoNegativo>,
);

/** Quantidades de uma troca (micro-unidades); só os recursos envolvidos. */
const esquemaTroca = z.partialRecord(z.enum(RECURSOS), naoNegativo);

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
  /** Esquema 11 (Portão 22): mora no Quartel General (não ocupa vaga da Taverna) e atravessa a ascensão. */
  alojado: z.boolean(),
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
    /**
     * Esquema 6: Ocioso é um ofício (não produz, come); `ativoEm` só existe
     * enquanto o aldeão se desloca para um ofício novo (não produz até lá).
     */
    aldeoes: z.array(z.strictObject({ oficio: z.enum(OFICIOS_ALDEAO), ativoEm: instante.optional() })),
    /**
     * Distribuição dos que chegam (Portão 17): automática segue a política;
     * desligada, chegam ociosos. "manter" usa a `proporcao` gravada no último
     * ajuste manual (só ofícios produtivos).
     */
    aldeoesConfig: z.strictObject({
      automatica: z.boolean(),
      politica: z.enum(POLITICAS_ALDEOES),
      proporcao: z.partialRecord(z.enum(OFICIOS), naoNegativo).optional(),
    }),
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
    /** Mercador Viajante esperando resposta. Esquema 5: os termos da troca vão no evento. */
    mercador: z.strictObject({ expiraEm: instante, paga: esquemaTroca, recebe: esquemaTroca }).nullable(),
    /** Falha da era (Portão 18b, esquema 7): sobe 1 a cada Ascensão, até o máximo; persiste como as relíquias. */
    falha: z.number().int().min(0).max(FALHA.nivelMaximo),
    reliquias: z.strictObject({
      total: naoNegativo,
      gastas: naoNegativo,
      niveis: z.partialRecord(z.enum(RELIQUIAS_IDS), naoNegativo),
    }),
    /** Baldes de fichas do clique (fichas em milésimos), no relógio do servidor. */
    cliques: z.strictObject({ usuario: esquemaBalde, objetos: z.record(z.string(), esquemaBalde) }),
    cronica: z.array(z.strictObject({ icone: z.string(), texto: z.string(), em: instante })),
    /**
     * Esquema 10 (Portão 21): o Quartel General. `oculto` até uma expedição às Ruínas voltar, depois `ruinas` (dá para
     * reerguer pagando) e `reerguido`. `desde` é o instante em que o estado atual começou (a dica do Sábio conta
     * a partir dele). Esquema 11: `nivel` (0 até reerguer, 1 depois) manda no Alojamento. Atravessa a ascensão.
     */
    qg: z.strictObject({ estado: z.enum(QG_ESTADOS), desde: instante, nivel: inteiro.min(0).max(QG.alojamentoPorNivel.length - 1) }),
    /** Esquema 8 (Portão 16): capítulos do Diário liberados, na ordem; atravessa a ascensão. */
    diario: z.array(z.enum(CAPITULOS_IDS)),
    /** Esquema 8: o prólogo já foi visto (não abre de novo, nem noutro aparelho). */
    prologoVisto: z.boolean(),
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
  if (versao === 4) {
    // Esquema 5: um Mercador pendente ganha os termos atuais (os mesmos que a resposta cobrava).
    const mercador = estado.mercador as { expiraEm: number } | null | undefined;
    estado = { ...estado, versao: 5, mercador: mercador ? { ...mercador, ...termosDoMercador() } : null };
    versao = 5;
  }
  if (versao === 5) {
    // Esquema 6 (Portão 17): os ofícios gravados ficam; a distribuição automática liga em Equilibrada.
    estado = { ...estado, versao: 6, aldeoesConfig: { ...CONFIG_ALDEOES_INICIAL } };
    versao = 6;
  }
  if (versao === 6) {
    // Falha (Portão 18b): ninguém é afetado retroativamente; todos começam em 0 e sobem na próxima ascensão.
    estado = { ...estado, versao: 7, falha: 0 };
    versao = 7;
  }
  if (versao === 7) {
    // Diário (Portão 16): o que já vale hoje, mais a Era I de quem já ascendeu; contas antigas não veem o prólogo de novo.
    estado = { ...estado, versao: 8, diario: diarioDaMigracao(estado as Parameters<typeof diarioDaMigracao>[0]), prologoVisto: true };
    versao = 8;
  }
  if (versao === 8) {
    // Classes 5 → 4 (Portão 20a): só o id da classe muda; nível, XP, equipamento, estado, nome e id ficam.
    // Expedições e relatórios guardam só ids de aventureiro; a Crônica não cita classes.
    const aventureiros = (estado.aventureiros as { classe: keyof typeof CLASSES_ANTIGAS }[]).map((a) => ({ ...a, classe: CLASSES_ANTIGAS[a.classe] ?? a.classe }));
    estado = { ...estado, versao: 9, aventureiros };
    versao = 9;
  }
  if (versao === 9) {
    // Quartel General (Portão 21): ninguém o descobriu ainda; a dica do Sábio conta a partir deste save.
    estado = { ...estado, versao: 10, qg: { estado: 'oculto', desde: estado.t } };
    versao = 10;
  }
  if (versao === 10) {
    // Alojamento (Portão 22): ninguém mora no QG ainda; o nível do QG vale 1 se ele já foi reerguido.
    const qg = estado.qg as { estado: string; desde: number };
    const aventureiros = (estado.aventureiros as Record<string, unknown>[]).map((a) => ({ ...a, alojado: false }));
    estado = { ...estado, versao: 11, aventureiros, qg: { ...qg, nivel: qg.estado === 'reerguido' ? QG.nivelAoReerguer : 0 } };
    versao = 11;
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
