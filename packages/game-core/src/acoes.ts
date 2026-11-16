// Ações do jogador como comandos: o cliente manda a intenção e ids, nunca
// quantidades ou resultados. Cada ação liquida o estado até "agora", valida
// e aplica, ou recusa com um código de erro. Nada é alterado no recusado.
import { z } from 'zod';
import { DESLOCAMENTO_ALDEAO_MS, OFICIO_OCIOSO, OFICIOS_ALDEAO, POLITICAS_ALDEOES } from '../data/aldeoes.ts';
import { CLASSES, OFICIOS, type Oficio } from '../data/aventureiros.ts';
import { CONSTRUCOES, NIVEL_MAXIMO_CONSTRUCAO } from '../data/construcoes.ts';
import { DESTINOS, DESTINOS_IDS, TAMANHO_MAXIMO_GRUPO } from '../data/expedicoes.ts';
import { FALHA } from '../data/falha.ts';
import { FORMULAS } from '../data/formulas.ts';
import { PESQUISAS, PESQUISAS_IDS } from '../data/pesquisas.ts';
import { RECURSOS, type Recurso } from '../data/recursos.ts';
import { RELIQUIAS, RELIQUIAS_IDS } from '../data/reliquias.ts';
import { SLOT_IDS, SLOTS, type SlotId } from '../data/slots.ts';
import { registrar } from './cronica.ts';
import type { EstadoJogo, ResultadoExpedicao } from './estado.ts';
import {
  bonusSaqueBp, chanceExitoBp, custoConstrucao, custoContratar, custoEquipamento, custoReliquia,
  custoPesquisa, duracaoExpedicaoMs, duracaoPesquisaMs, ganhoCliqueMicro, perigoDestino, poderAventureiro, reliquiasNaAscensao, tempoObraMs, type Custo,
} from './formulas.ts';
import { estadoInicial, sortearNome } from './inicial.ts';
import { aplicarBonus, bp, mili, micro } from './inteiros.ts';
import { liberarCapitulos } from './diario.ts';
import { liquidar, receber } from './liquidar.ts';
import { descreverTroca } from './mercador.ts';
import { destinoAberto, nivelReliquia, objetivosEra, quantosNoOficio, vagasGuilda } from './regras.ts';
import { criarSorteador, type Sorteador } from './rng.ts';

const idCurto = z.string().min(1).max(32);
const slotId = z.enum(SLOT_IDS as [SlotId, ...SlotId[]]);

export const esquemaAcao = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('construir'), slot: slotId }),
  z.strictObject({ tipo: z.literal('melhorar'), slot: slotId }),
  z.strictObject({ tipo: z.literal('pesquisar'), pesquisa: z.enum(PESQUISAS_IDS) }),
  z.strictObject({ tipo: z.literal('contratar') }),
  z.strictObject({ tipo: z.literal('melhorar_equipamento'), aventureiro: idCurto, peca: z.enum(['arma', 'armadura']) }),
  z.strictObject({
    tipo: z.literal('partir_expedicao'),
    destino: z.enum(DESTINOS_IDS),
    grupo: z.array(idCurto).min(1).max(TAMANHO_MAXIMO_GRUPO),
  }),
  z.strictObject({ tipo: z.literal('responder_mercador'), aceitar: z.boolean() }),
  z.strictObject({
    tipo: z.literal('alocar_aldeoes'),
    de: z.enum(OFICIOS_ALDEAO),
    para: z.enum(OFICIOS_ALDEAO),
    quantidade: z.number().int().min(1).max(FORMULAS.aldeoes.porNivelDeCasa * NIVEL_MAXIMO_CONSTRUCAO),
  }),
  z.strictObject({ tipo: z.literal('configurar_aldeoes'), automatica: z.boolean(), politica: z.enum(POLITICAS_ALDEOES) }),
  z.strictObject({ tipo: z.literal('comprar_reliquia'), reliquia: z.enum(RELIQUIAS_IDS) }),
  z.strictObject({ tipo: z.literal('ascender') }),
  z.strictObject({ tipo: z.literal('fechar_prologo') }),
  z.strictObject({
    tipo: z.literal('clicar'),
    objeto: idCurto,
    quantidade: z.number().int().min(1).max(FORMULAS.clique.maximoPorLote),
  }),
]);

export type Acao = z.infer<typeof esquemaAcao>;
export type TipoAcao = Acao['tipo'];

export type ErroAcao =
  | 'slot_ocupado' | 'slot_ja_construido' | 'slot_vazio' | 'nivel_maximo'
  | 'recursos_insuficientes'
  | 'pesquisa_em_andamento' | 'pesquisa_concluida' | 'requisito_pendente'
  | 'guilda_cheia' | 'aventureiro_inexistente' | 'aventureiro_indisponivel' | 'equipamento_maximo'
  | 'destino_bloqueado' | 'grupo_invalido' | 'sem_comida'
  | 'sem_mercador'
  | 'alocacao_invalida' | 'aldeoes_insuficientes'
  | 'reliquia_maxima' | 'reliquias_insuficientes'
  | 'objetivos_pendentes'
  | 'objeto_invalido' | 'limite_cliques';

export type ResultadoAcao =
  | { ok: true; estado: EstadoJogo; cliquesAceitos?: number }
  | { ok: false; erro: ErroAcao; estado: EstadoJogo };

export interface OpcoesAcao {
  /** Objetos clicáveis do mapa (árvores, pedras), id -> recurso: a lista `clicaveis` do meta (objetosDoMapa). */
  objetosDoMapa?: Readonly<Record<string, Recurso>>;
}

function podePagar(e: EstadoJogo, custo: Custo): boolean {
  return (Object.entries(custo) as [Recurso, number][]).every(([r, v]) => e.recursos[r] >= v);
}

function pagar(e: EstadoJogo, custo: Custo) {
  for (const [r, v] of Object.entries(custo) as [Recurso, number][]) e.recursos[r] -= v;
}

/** Objetos clicáveis: construções produtoras construídas (id do slot) e os do mapa. */
/** Recurso que o clique no objeto rende: árvore e pedra pelo mapa, construção produtora pelo slot. */
export function recursoDoObjeto(e: Pick<EstadoJogo, 'slots'>, objeto: string, opcoes: OpcoesAcao = {}): Recurso | null {
  if (objeto in SLOTS) {
    const id = objeto as keyof typeof SLOTS;
    const dados = CONSTRUCOES[SLOTS[id].tipo];
    // O Scriptorium abre a Pesquisa no clique: não rende saber.
    return dados.producao && !dados.cliqueAbre && e.slots[id].nivel >= 1 ? dados.producao.recurso : null;
  }
  return opcoes.objetosDoMapa?.[objeto] ?? null;
}

/** Recarrega um balde de fichas (em milésimos; taxa em fichas/s = milésimos/ms). */
function recarregar(balde: { fichas: number; em: number }, porSegundo: number, agora: number) {
  const capacidade = porSegundo * 1000;
  return Math.min(capacidade, balde.fichas + porSegundo * Math.max(0, agora - balde.em));
}

function sortearResultado(e: EstadoJogo, destino: keyof typeof DESTINOS, grupo: string[], s: Sorteador): ResultadoExpedicao {
  const poder = grupo.reduce((soma, id) => soma + poderAventureiro(e.aventureiros.find((a) => a.id === id)!), 0);
  const vitoria = s.chance(chanceExitoBp(poder, perigoDestino(destino, e.falha)));
  const saque: Partial<Record<Recurso, number>> = {};
  const feridos: string[] = [];
  if (vitoria) {
    const bonus = bonusSaqueBp(grupo.length);
    for (const r of RECURSOS) {
      const faixa = DESTINOS[destino].saque[r];
      if (!faixa) continue;
      const sorteado = s.inteiro(mili(faixa[0]), mili(faixa[1])); // em milésimos
      saque[r] = aplicarBonus(sorteado * 1000, bonus);
    }
  } else {
    for (const id of grupo) if (s.chance(bp(FORMULAS.aventureiro.chanceFerimento))) feridos.push(id);
  }
  return { vitoria, saque, feridos };
}

type Aplicador = (e: EstadoJogo, s: Sorteador) => ErroAcao | { cliquesAceitos: number } | void;

function aplicador(acao: Acao, agora: number, opcoes: OpcoesAcao): Aplicador {
  switch (acao.tipo) {
    case 'construir':
    case 'melhorar':
      return (e) => {
        const id = acao.slot;
        const slot = e.slots[id];
        if (slot.obraAte !== null) return 'slot_ocupado';
        if (acao.tipo === 'construir' && slot.nivel > 0) return 'slot_ja_construido';
        if (acao.tipo === 'melhorar' && slot.nivel === 0) return 'slot_vazio';
        if (slot.nivel >= NIVEL_MAXIMO_CONSTRUCAO) return 'nivel_maximo';
        const alvo = slot.nivel + 1;
        const custo = custoConstrucao(SLOTS[id].tipo, alvo);
        if (!podePagar(e, custo)) return 'recursos_insuficientes';
        pagar(e, custo);
        slot.obraAte = e.t + tempoObraMs(alvo, e.falha);
        const nome = CONSTRUCOES[SLOTS[id].tipo].nome;
        registrar(e, 'Construir', alvo === 1 ? `Obra iniciada: ${nome}.` : `Obra iniciada: ${nome} nível ${alvo}.`, e.t);
      };

    case 'pesquisar':
      return (e) => {
        const p = PESQUISAS[acao.pesquisa];
        if (e.pesquisas.atual) return 'pesquisa_em_andamento';
        if (e.pesquisas.concluidas.includes(acao.pesquisa)) return 'pesquisa_concluida';
        if (!p.requer.every((r) => e.pesquisas.concluidas.includes(r))) return 'requisito_pendente';
        // Falha: Estradas Reais e Carta Real mais caras; toda pesquisa mais lenta.
        const custo = custoPesquisa(acao.pesquisa, e.falha);
        if (!podePagar(e, custo)) return 'recursos_insuficientes';
        pagar(e, custo);
        e.pesquisas.atual = { id: acao.pesquisa, fim: e.t + duracaoPesquisaMs(acao.pesquisa, e.falha) };
        registrar(e, 'Saber', `Pesquisa iniciada: ${p.nome}.`, e.t);
      };

    case 'contratar':
      return (e, s) => {
        if (e.aventureiros.length >= vagasGuilda(e)) return 'guilda_cheia';
        const custo = custoContratar(e.contratacoes);
        if (!podePagar(e, custo)) return 'recursos_insuficientes';
        pagar(e, custo);
        const A = FORMULAS.aventureiro;
        const nivel = Math.min(
          A.nivelMaximo,
          A.nivelInicial + FORMULAS.reliquias.linhagemHeroicaPorNivel * nivelReliquia(e, 'linhagem_heroica'),
        );
        const nome = sortearNome(s, e.aventureiros.map((a) => a.nome));
        e.aventureiros.push({
          id: `a${e.proximoId++}`, nome, classe: s.escolher(CLASSES), nivel, xp: 0,
          arma: 0, armadura: 0, estado: 'na_vila', feridoAte: null,
        });
        e.contratacoes += 1;
        registrar(e, 'Aventureiro', `${nome} entrou para a guilda.`, e.t);
      };

    case 'melhorar_equipamento':
      return (e) => {
        const av = e.aventureiros.find((a) => a.id === acao.aventureiro);
        if (!av) return 'aventureiro_inexistente';
        if (av.estado === 'em_expedicao') return 'aventureiro_indisponivel';
        const atual = av[acao.peca];
        if (atual >= FORMULAS.aventureiro.equipamentoMaximo) return 'equipamento_maximo';
        const custo = custoEquipamento(acao.peca, atual);
        if (!podePagar(e, custo)) return 'recursos_insuficientes';
        pagar(e, custo);
        av[acao.peca] = atual + 1;
        registrar(e, 'Aventureiro', `${av.nome}: ${acao.peca === 'arma' ? 'arma' : 'armadura'} nível ${atual + 1}.`, e.t);
      };

    case 'partir_expedicao':
      return (e, s) => {
        if (!destinoAberto(e, acao.destino)) return 'destino_bloqueado';
        if (new Set(acao.grupo).size !== acao.grupo.length) return 'grupo_invalido';
        for (const id of acao.grupo) {
          const av = e.aventureiros.find((a) => a.id === id);
          if (!av) return 'aventureiro_inexistente';
          if (av.estado !== 'na_vila') return 'aventureiro_indisponivel';
        }
        if (e.recursos.comida <= 0) return 'sem_comida';
        const id = `x${e.proximoId++}`;
        e.segredo.resultados[id] = sortearResultado(e, acao.destino, acao.grupo, s);
        const fim = e.t + duracaoExpedicaoMs(acao.destino, nivelReliquia(e, 'caminhos_eternos'));
        e.expedicoes.push({ id, destino: acao.destino, grupo: [...acao.grupo], inicio: e.t, fim });
        for (const avId of acao.grupo) e.aventureiros.find((a) => a.id === avId)!.estado = 'em_expedicao';
        registrar(e, 'Expedicao', `Um grupo partiu para ${DESTINOS[acao.destino].nome}.`, e.t);
      };

    case 'responder_mercador':
      return (e) => {
        if (!e.mercador) return 'sem_mercador';
        // Cobra e paga os termos gravados no evento (o que a tela mostrou), não a constante.
        const { paga, recebe } = e.mercador;
        if (acao.aceitar) {
          if (!podePagar(e, paga)) return 'recursos_insuficientes';
          pagar(e, paga);
          receber(e, recebe);
          registrar(e, 'Ouro', `Negócio feito com o Mercador: ${descreverTroca(paga)} por ${descreverTroca(recebe)}.`, e.t);
        } else {
          registrar(e, 'Evento', 'O Mercador Viajante foi dispensado.', e.t);
        }
        e.mercador = null;
      };

    case 'alocar_aldeoes':
      return (e) => {
        if (acao.de === acao.para) return 'alocacao_invalida';
        // Os últimos do ofício de origem mudam (quem chegou por último sai primeiro).
        const daOrigem = e.aldeoes.filter((a) => a.oficio === acao.de);
        if (daOrigem.length < acao.quantidade) return 'aldeoes_insuficientes';
        for (const a of daOrigem.slice(-acao.quantidade)) {
          a.oficio = acao.para;
          // Ir para Ocioso é na hora; para um ofício, o aldeão leva o deslocamento para começar a produzir.
          if (acao.para === OFICIO_OCIOSO) delete a.ativoEm;
          else a.ativoEm = e.t + DESLOCAMENTO_ALDEAO_MS;
        }
        // Ajuste manual: a automática segue a distribuição que o jogador montou.
        const proporcao: Partial<Record<Oficio, number>> = {};
        for (const o of OFICIOS) proporcao[o] = quantosNoOficio(e, o);
        e.aldeoesConfig = { automatica: e.aldeoesConfig.automatica, politica: 'manter', proporcao };
      };

    case 'configurar_aldeoes':
      return (e) => {
        // "manter" não se escolhe: só vale para ligar/desligar mantendo a proporção do último ajuste.
        if (acao.politica === 'manter') {
          if (e.aldeoesConfig.politica !== 'manter') return 'alocacao_invalida';
          e.aldeoesConfig = { ...e.aldeoesConfig, automatica: acao.automatica };
          return;
        }
        // Política pronta substitui a proporção do ajuste manual.
        e.aldeoesConfig = { automatica: acao.automatica, politica: acao.politica };
      };

    case 'comprar_reliquia':
      return (e) => {
        const dados = RELIQUIAS[acao.reliquia];
        const nivel = nivelReliquia(e, acao.reliquia);
        if (nivel >= dados.nivelMaximo) return 'reliquia_maxima';
        const custo = custoReliquia(acao.reliquia, nivel);
        if (e.reliquias.total - e.reliquias.gastas < custo) return 'reliquias_insuficientes';
        e.reliquias.gastas += custo;
        e.reliquias.niveis[acao.reliquia] = nivel + 1;
        registrar(e, 'Reliquia', `${dados.nome} chegou ao nível ${nivel + 1}.`, e.t);
      };

    case 'fechar_prologo':
      return (e) => {
        e.prologoVisto = true;
      };

    case 'ascender':
      // Tratada à parte em aplicarAcao: troca o estado inteiro.
      return () => undefined;

    case 'clicar':
      return (e) => {
        const recurso = recursoDoObjeto(e, acao.objeto, opcoes);
        if (!recurso) return 'objeto_invalido';
        const C = FORMULAS.clique;
        const usuario = recarregar(e.cliques.usuario, C.porSegundoUsuario, agora);
        const objeto = recarregar(e.cliques.objetos[acao.objeto] ?? { fichas: C.porSegundoObjeto * 1000, em: agora }, C.porSegundoObjeto, agora);
        const aceitos = Math.min(acao.quantidade, Math.floor(usuario / 1000), Math.floor(objeto / 1000));
        if (aceitos === 0) return 'limite_cliques';
        e.cliques.usuario = { fichas: usuario - aceitos * 1000, em: agora };
        e.cliques.objetos[acao.objeto] = { fichas: objeto - aceitos * 1000, em: agora };
        // Baldes que já estariam cheios não precisam ficar no estado.
        for (const [id, b] of Object.entries(e.cliques.objetos)) {
          if (id !== acao.objeto && recarregar(b, C.porSegundoObjeto, agora) >= C.porSegundoObjeto * 1000) {
            delete e.cliques.objetos[id];
          }
        }
        receber(e, { [recurso]: aceitos * ganhoCliqueMicro(nivelReliquia(e, 'maos_calejadas')) });
        return { cliquesAceitos: aceitos };
      };
  }
}

function ascender(e: EstadoJogo, s: Sorteador): ErroAcao | EstadoJogo {
  if (!objetivosEra(e).todos) return 'objetivos_pendentes';
  const ganho = reliquiasNaAscensao(e.ciclo);
  const novo = estadoInicial({
    semente: s.inteiro(0, 0xffffffff),
    agora: e.t,
    ciclo: e.ciclo + 1,
    reliquias: { ...e.reliquias, total: e.reliquias.total + ganho },
    // A Falha sobe 1 a cada Ascensão, até o máximo, e passa para o ciclo seguinte.
    falha: Math.min(FALHA.nivelMaximo, e.falha + 1),
    cronica: e.cronica,
    diario: e.diario,
    prologoVisto: e.prologoVisto,
  });
  registrar(novo, 'Ascensao', `Ascensão! O reino renasce no ciclo ${novo.ciclo} com +${ganho} relíquias.`, e.t);
  liberarCapitulos(novo, e.t);
  return novo;
}

/**
 * Aplica uma ação no instante `agora` (relógio do servidor). Sempre devolve
 * o estado liquidado até agora; se a ação for recusada, só a liquidação vale.
 */
export function aplicarAcao(estado: EstadoJogo, acao: Acao, agora: number, opcoes: OpcoesAcao = {}): ResultadoAcao {
  const liquidado = liquidar(estado, agora);
  const e = structuredClone(liquidado);
  const s = criarSorteador(e.segredo.rng);

  if (acao.tipo === 'ascender') {
    const r = ascender(e, s);
    if (typeof r === 'string') return { ok: false, erro: r, estado: liquidado };
    return { ok: true, estado: r };
  }

  const r = aplicador(acao, Math.max(agora, e.t), opcoes)(e, s);
  if (typeof r === 'string') return { ok: false, erro: r, estado: liquidado };
  e.segredo.rng = s.estado;
  return r ? { ok: true, estado: e, cliquesAceitos: r.cliquesAceitos } : { ok: true, estado: e };
}
