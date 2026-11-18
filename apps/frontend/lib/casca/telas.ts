// Dados das telas Heróis, Expedições e Eras (Portão 12). Tudo vem do estado e
// das regras do game-core; nada de número fixo aqui. Funções puras.

import {
  aventureirosNaTaverna, calcularTaxas, capacidadeAlojamento, CLASSES, chanceExitoBp, consumoComidaAventureiros, ordemDeAtravessar, VENCE, custoContratar, custoEquipamento, custoReliquia, DESTINO_QG, DESTINOS, DESTINOS_IDS, destinoAberto, destinoVisivel, duracaoExpedicaoMs,
  ERAS, FALHA, FORMULAS, MICRO, perigoDestino, TEXTOS_FALHA, NIVEL_MAXIMO_CONSTRUCAO, NOMES_CLASSES, nivelReliquia, objetivosEra, OBJETIVOS_ERA_1, PESQUISAS,
  poderAventureiro, QG, RELIQUIAS, RELIQUIAS_IDS, SLOT_IDS, SLOTS, TAMANHO_MAXIMO_GRUPO, TEXTOS_QG, vagasGuilda,
  type Classe, type DestinoId, type Recurso, type RefSprite, type ReliquiaId, type VisaoCliente,
} from '@cronarca/game-core';
import { formatarHora, formatarInteiro, formatarRestante, formatarTaxa, textoEra } from './dados';

type Custo = Partial<Record<Recurso, number>>;
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const podePagar = (e: VisaoCliente, custo: Custo) => (Object.entries(custo) as [Recurso, number][]).every(([r, v]) => e.recursos[r] >= v);
export const custoNaTela = (custo: Custo) => (Object.entries(custo) as [Recurso, number][]).map(([recurso, v]) => ({ recurso, valor: formatarInteiro(v) }));

/** "Aldric", "Aldric e Dara", "Aldric, Dara e Elisa". */
export function juntarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

// ---------- Heróis ----------

export type EstadoHeroi = { tipo: 'na_vila' | 'em_expedicao' | 'ferido'; texto: string };

export interface Peca {
  nivel: number;
  maximo: number;
  custo: { recurso: Recurso; valor: string }[];
  /** Pode melhorar agora (no máximo, em expedição ou sem recursos: não). */
  pode: boolean;
  motivo: string | null;
}

export interface CartaHeroi {
  id: string;
  nome: string;
  classe: Classe;
  linha: string;
  poder: number;
  estado: EstadoHeroi;
  arma: Peca;
  armadura: Peca;
  /** Mora no Quartel General (Portão 22): etiqueta "Alojado" e fora das vagas da Taverna. */
  alojado: boolean;
  /** Ícone da classe (icone-classe-<id>) e a linha "vence X · fraco contra Y". */
  iconeClasse: string;
  vantagem: string;
}

function estadoDoHeroi(a: VisaoCliente['aventureiros'][number], agora: number): EstadoHeroi {
  if (a.estado === 'em_expedicao') return { tipo: 'em_expedicao', texto: 'Em expedição' };
  if (a.estado === 'ferido') return { tipo: 'ferido', texto: `Ferido ${formatarRestante((a.feridoAte ?? agora) - agora)}` };
  return { tipo: 'na_vila', texto: 'Na vila' };
}

function pecaDe(e: VisaoCliente, a: VisaoCliente['aventureiros'][number], peca: 'arma' | 'armadura'): Peca {
  const maximo = FORMULAS.aventureiro.equipamentoMaximo;
  const nivel = a[peca];
  if (nivel >= maximo) return { nivel, maximo, custo: [], pode: false, motivo: 'Nível máximo' };
  const custo = custoEquipamento(peca, nivel);
  const ocupado = a.estado === 'em_expedicao';
  const pagavel = podePagar(e, custo);
  return { nivel, maximo, custo: custoNaTela(custo), pode: !ocupado && pagavel, motivo: ocupado ? 'Em expedição' : pagavel ? null : 'Recursos insuficientes' };
}

export function cartasHerois(e: VisaoCliente, agora: number): CartaHeroi[] {
  return e.aventureiros.map((a) => ({
    id: a.id,
    nome: a.nome,
    classe: a.classe,
    linha: `${NOMES_CLASSES[a.classe]} · nível ${a.nivel}`,
    poder: poderAventureiro(a),
    estado: estadoDoHeroi(a, agora),
    arma: pecaDe(e, a, 'arma'),
    armadura: pecaDe(e, a, 'armadura'),
    alojado: a.alojado,
    iconeClasse: `icone-classe-${a.classe}`,
    vantagem: vantagemDaClasse(a.classe),
  }));
}

/** "Vence Cavaleiro · fraco contra Arqueiro"; o Mago do Tempo é suporte, sem vantagem (dados do combate). */
export function vantagemDaClasse(c: Classe): string {
  const vence = VENCE[c];
  const fraco = CLASSES.find((x) => VENCE[x] === c);
  if (!vence || !fraco) return 'Suporte: atrasa os inimigos e acelera a tropa';
  return `Vence ${NOMES_CLASSES[vence]} · fraco contra ${NOMES_CLASSES[fraco]}`;
}

export interface Guilda {
  vagas: string;
  subtitulo: string;
  contratar: {
    custo: { recurso: Recurso; valor: string }[];
    pode: boolean;
    motivo: string | null;
    /** Efeito na comida antes de contratar: "Saldo de comida: +0,07/s → −0,01/s". */
    comida: { texto: string; alerta: boolean };
  };
  resumo: { poderTotal: number; vagas: string; consumo: string; proximaVaga: string; cabecalho: string };
}

/**
 * Cada aventureiro come comida (curva C do Portão 22: cada um come base + crescimento × (n − 1)): mostra o saldo de agora
 * e o de depois da contratação. Negativo vira alerta (com a comida em 0 a expedição não parte).
 */
export function efeitoNaComida(e: VisaoCliente): { texto: string; alerta: boolean } {
  const n = e.aventureiros.length;
  const agora = calcularTaxas(e).saldo.comida;
  const depois = agora - (consumoComidaAventureiros(n + 1) - consumoComidaAventureiros(n));
  const cadaUm = consumoComidaAventureiros(n + 1) / (n + 1) / 1000;
  const texto = `Com ${n + 1} aventureiros, cada um come ${decimal.format(cadaUm)} comida/s. Saldo de comida: ${formatarTaxa(agora)} → ${formatarTaxa(depois)}`;
  return depois < 0 ? { texto: `${texto}. Vai faltar comida: melhore a Casa antes.`, alerta: true } : { texto, alerta: false };
}

/** O que o botão do Quartel General faz: dica das Ruínas (ainda oculto), modal de reerguer (ruínas) ou a Tropa (reerguido). */
export type CliqueQg = { tipo: 'dica'; texto: string } | { tipo: 'reerguer' } | { tipo: 'tropa' };

export function cliqueDoQg(e: VisaoCliente): CliqueQg {
  if (e.qg.estado === 'oculto') return { tipo: 'dica', texto: TEXTOS_QG.bloqueado };
  if (e.qg.estado === 'ruinas') return { tipo: 'reerguer' };
  return { tipo: 'tropa' };
}

export type SubabaQg = 'mesa' | 'enfermaria';

/** Texto e subtítulo das subabas que dependem do QG: Bloqueada até reerguer; "Em breve" só depois (a tela chega no Portão 23/24). */
export function textoDaSubaba(e: VisaoCliente, subaba: SubabaQg): { subtitulo: string; texto: string } {
  const mesa = subaba === 'mesa';
  if (e.qg.estado === 'oculto') return { subtitulo: 'Bloqueada', texto: TEXTOS_QG.bloqueado };
  if (e.qg.estado === 'ruinas') return { subtitulo: 'Bloqueada', texto: mesa ? TEXTOS_QG.mesaDeGuerraReerga : TEXTOS_QG.enfermariaReerga };
  return { subtitulo: 'Em breve', texto: mesa ? TEXTOS_QG.mesaDeGuerraEmBreve : TEXTOS_QG.enfermariaEmBreve };
}

export interface Alojamento {
  /** QG reerguido: o Alojamento existe. */
  disponivel: boolean;
  capacidade: number;
  ocupados: number;
  /** "Alojamento 2 / 3" ou o aviso de bloqueado. */
  linha: string;
  /** Quem atravessaria o reset agora (os mais fortes, até a capacidade), por nome. */
  atravessam: string[];
  /** Há mais gente do que vagas: parte da guilda sairia no reset. */
  excedente: boolean;
}

/** O Alojamento do QG: capacidade, quem já mora nele e quem atravessaria a ascensão (os mais fortes). */
export function alojamento(e: VisaoCliente): Alojamento {
  const capacidade = capacidadeAlojamento(e);
  const disponivel = e.qg.estado === 'reerguido';
  const ocupados = e.aventureiros.filter((a) => a.alojado).length;
  const ordem = ordemDeAtravessar(e.aventureiros);
  return {
    disponivel,
    capacidade,
    ocupados,
    linha: disponivel ? `${TEXTOS_QG.tituloAlojamento} ${ocupados} / ${capacidade}` : TEXTOS_QG.alojamentoBloqueado,
    atravessam: disponivel ? ordem.slice(0, capacidade).map((a) => a.nome) : [],
    excedente: disponivel && e.aventureiros.length > capacidade,
  };
}

export interface Guilda {
  vagas: string;
  subtitulo: string;
  contratar: {
    custo: { recurso: Recurso; valor: string }[];
    pode: boolean;
    motivo: string | null;
    /** Efeito na comida antes de contratar: "Saldo de comida: +0,07/s → −0,01/s". */
    comida: { texto: string; alerta: boolean };
  };
  resumo: { poderTotal: number; vagas: string; consumo: string; proximaVaga: string; cabecalho: string };
  alojamento: Alojamento;
}

export function guilda(e: VisaoCliente): Guilda {
  const vagas = vagasGuilda(e);
  // Só quem não mora no QG ocupa vaga da Taverna (Portão 22).
  const n = aventureirosNaTaverna(e);
  const custo = custoContratar(e.contratacoes);
  const cheia = n >= vagas;
  const pagavel = podePagar(e, custo);
  const consumo = consumoComidaAventureiros(e.aventureiros.length);
  const taverna = SLOT_IDS.filter((id) => SLOTS[id].tipo === 'taverna');
  const nivelTaverna = Math.max(0, ...taverna.map((id) => e.slots[id].nivel));
  const proximaVaga =
    nivelTaverna === 0 ? 'Construir a Taverna' : nivelTaverna >= NIVEL_MAXIMO_CONSTRUCAO ? 'Taverna no nível máximo' : `Taverna nível ${nivelTaverna + 1}`;
  return {
    vagas: `${n} / ${vagas}`,
    subtitulo: `${n} / ${vagas} vagas da Taverna · consomem comida`,
    contratar: {
      custo: custoNaTela(custo),
      pode: !cheia && pagavel,
      motivo: cheia ? 'Guilda cheia' : pagavel ? null : 'Recursos insuficientes',
      comida: efeitoNaComida(e),
    },
    resumo: {
      poderTotal: e.aventureiros.reduce((s, a) => s + poderAventureiro(a), 0),
      vagas: `${n} de ${vagas}`,
      consumo: formatarTaxa(-consumo),
      proximaVaga,
      cabecalho: `${textoEra(e.era).split(' · ')[0]} · Ciclo ${e.ciclo}`,
    },
    alojamento: alojamento(e),
  };
}

// ---------- Contratar com classe (Portão 22) ----------

export interface OpcaoClasse {
  classe: Classe;
  nome: string;
  /** Ícone da classe (icone-classe-<id>) e sprite do herói. */
  icone: string;
  sprite: RefSprite;
  vantagem: string;
}

export interface DadosContratar {
  classes: OpcaoClasse[];
  custo: { recurso: Recurso; valor: string; falta: boolean }[];
  /** "2 / 4": quem ocupa vaga da Taverna e as vagas. */
  vagas: string;
  pode: boolean;
  motivo: string | null;
  comida: { texto: string; alerta: boolean };
}

/** O modal Contratar: as 4 classes (a escolha é do jogador), o custo de sempre, as vagas e o efeito na comida. */
export function dadosContratar(e: VisaoCliente): DadosContratar {
  const g = guilda(e);
  const custo = custoContratar(e.contratacoes);
  return {
    classes: CLASSES.map((classe) => ({
      classe, nome: NOMES_CLASSES[classe], icone: `icone-classe-${classe}`, sprite: { grupo: 'aventureiro', id: classe }, vantagem: vantagemDaClasse(classe),
    })),
    custo: (Object.entries(custo) as [Recurso, number][]).map(([recurso, v]) => ({ recurso, valor: formatarInteiro(v), falta: e.recursos[recurso] < v })),
    vagas: g.vagas,
    pode: g.contratar.pode,
    motivo: g.contratar.motivo,
    comida: g.contratar.comida,
  };
}

// ---------- Expedições ----------

export interface ChipGrupo {
  id: string;
  nome: string;
  classe: Classe;
  linha: string;
  selecionado: boolean;
  disponivel: boolean;
  motivo: string | null;
}

/** Só quem está na vila entra no grupo; o grupo vale só com ids que ainda podem ir. */
export function grupoValido(e: VisaoCliente, selecionados: readonly string[]): string[] {
  return selecionados.filter((id) => e.aventureiros.find((a) => a.id === id)?.estado === 'na_vila').slice(0, TAMANHO_MAXIMO_GRUPO);
}

export function chipsGrupo(e: VisaoCliente, selecionados: readonly string[], agora = e.t): { chips: ChipGrupo[]; poder: number } {
  const grupo = grupoValido(e, selecionados);
  const cheio = grupo.length >= TAMANHO_MAXIMO_GRUPO;
  const chips = e.aventureiros.map((a): ChipGrupo => {
    const selecionado = grupo.includes(a.id);
    const ferido = a.feridoAte !== null ? `Ferido · ${formatarRestante(Math.max(0, a.feridoAte - agora)).replace(/^0(\d):/, '$1:')}` : 'Ferido';
    const fora = a.estado === 'em_expedicao' ? 'Em expedição' : a.estado === 'ferido' ? ferido : null;
    return {
      id: a.id,
      nome: a.nome,
      classe: a.classe,
      linha: `nível ${a.nivel} · poder ${poderAventureiro(a)}`,
      selecionado,
      disponivel: fora === null && (selecionado || !cheio),
      motivo: fora ?? (!selecionado && cheio ? `Grupo cheio (${TAMANHO_MAXIMO_GRUPO})` : null),
    };
  });
  return { chips, poder: grupo.reduce((s, id) => s + poderAventureiro(e.aventureiros.find((a) => a.id === id)!), 0) };
}

export interface Andamento {
  id: string;
  texto: string;
  progresso: number;
  restante: string;
}

export function emAndamento(e: VisaoCliente, agora: number): Andamento[] {
  return e.expedicoes.map((x) => ({
    id: x.id,
    texto: `${DESTINOS[x.destino].nome} · ${juntarNomes(x.grupo.map((id) => e.aventureiros.find((a) => a.id === id)?.nome ?? id))}`,
    progresso: Math.min(1, Math.max(0, (agora - x.inicio) / Math.max(1, x.fim - x.inicio))),
    restante: formatarRestante(x.fim - agora),
  }));
}

export interface LinhaDestino {
  destino: DestinoId;
  nome: string;
  descricao: string;
  aberto: boolean;
  requer: string | null;
  perigo: string;
  saque: { recurso: Recurso; faixa: string }[];
  /** Chance com o grupo escolhido (null sem grupo). */
  chance: { texto: string; nivel: 'alta' | 'media' | 'baixa' } | null;
  pode: boolean;
  motivo: string | null;
}

const faixa = ([a, b]: readonly [number, number]) => `${decimal.format(a)}–${decimal.format(b)}`;

/** Grupo sugerido ao clicar em "Enviar": quem está na vila, do mais forte ao mais fraco, até 3. */
export function grupoSugerido(e: VisaoCliente): string[] {
  return e.aventureiros
    .filter((a) => a.estado === 'na_vila')
    .sort((a, b) => poderAventureiro(b) - poderAventureiro(a))
    .slice(0, TAMANHO_MAXIMO_GRUPO)
    .map((a) => a.id);
}

/**
 * Por que a expedição não parte, em texto visível (no celular não há dica de
 * mouse): sem comida, ninguém disponível ou grupo vazio. null quando pode partir.
 */
export function avisoExpedicao(e: VisaoCliente, selecionados: readonly string[], agora = e.t): { texto: string; alerta: boolean } | null {
  if (e.recursos.comida <= 0) {
    return { texto: 'Sem comida: a expedição não parte. Pesquise Colheita Farta ou melhore a Casa (com a comida em 0 chegam Fazendeiros).', alerta: true };
  }
  const naVila = e.aventureiros.filter((a) => a.estado === 'na_vila');
  if (naVila.length === 0) {
    const voltas = e.aventureiros
      .map((a) => (a.estado === 'ferido' ? a.feridoAte : e.expedicoes.find((x) => x.grupo.includes(a.id))?.fim) ?? null)
      .filter((t): t is number => t !== null);
    const proxima = voltas.length ? Math.min(...voltas) : null;
    return { texto: proxima ? `Ninguém disponível: o próximo aventureiro volta em ${formatarRestante(Math.max(0, proxima - agora))}.` : 'Ninguém disponível na guilda.', alerta: true };
  }
  if (grupoValido(e, selecionados).length === 0) return { texto: 'Toque nos aventureiros do painel Grupo para escolher quem vai.', alerta: false };
  return null;
}

export function linhasDestinos(e: VisaoCliente, selecionados: readonly string[]): LinhaDestino[] {
  const grupo = grupoValido(e, selecionados);
  const poder = grupo.reduce((s, id) => s + poderAventureiro(e.aventureiros.find((a) => a.id === id)!), 0);
  return DESTINOS_IDS.filter((id) => destinoVisivel(e, id)).map((id) => {
    const d = DESTINOS[id];
    const aberto = destinoAberto(e, id);
    const duracao = duracaoExpedicaoMs(id, nivelReliquia(e, 'caminhos_eternos'));
    const perigo = perigoDestino(id, e.falha);
    const bp = grupo.length ? chanceExitoBp(poder, perigo) : null;
    const semComida = e.recursos.comida <= 0;
    return {
      destino: id,
      nome: d.nome,
      descricao: d.descricao,
      aberto,
      requer: aberto || !d.requer ? null : `Requer a pesquisa ${PESQUISAS[d.requer].nome}`,
      perigo: `Perigo ${perigo} · ${formatarRestante(duracao).replace(/^0(\d):/, '$1:')}`,
      saque: (Object.entries(d.saque) as [Recurso, readonly [number, number]][]).map(([recurso, f]) => ({ recurso, faixa: faixa(f) })),
      chance: bp === null ? null : { texto: `${Math.round(bp / 100)}%`, nivel: bp >= 8_000 ? 'alta' : bp >= 5_000 ? 'media' : 'baixa' },
      pode: aberto && grupo.length > 0 && !semComida,
      motivo: !aberto ? null : grupo.length === 0 ? 'Escolha o grupo' : semComida ? 'Sem comida' : null,
    };
  });
}

export interface CartaRelatorio {
  chave: string;
  nome: string;
  vitoria: boolean;
  hora: string;
  texto: string;
  saque: { recurso: Recurso; valor: string }[];
}

/** Do mais novo para o mais velho. */
export function relatorios(e: VisaoCliente): CartaRelatorio[] {
  return e.relatorios
    .map((r, i) => ({ r, i }))
    .reverse()
    .map(({ r, i }) => {
      const saque = (Object.entries(r.saque) as [Recurso, number][]).filter(([, v]) => v > 0).map(([recurso, v]) => ({ recurso, valor: decimal.format(Math.floor(v / 1000) / 1000) }));
      const quem = juntarNomes(r.grupo);
      const verbo = r.grupo.length > 1 ? 'voltaram' : 'voltou';
      const feridos = r.feridos.length === 0 ? `${quem} ${verbo} sem feridos.` : `${quem} ${verbo}; ${juntarNomes(r.feridos)} ${r.feridos.length > 1 ? 'feridos' : 'ferido'}.`;
      return {
        chave: `${r.em}-${i}`,
        nome: DESTINOS[r.destino].nome,
        vitoria: r.vitoria,
        hora: formatarHora(r.em),
        // Ruínas do QG: o recuo não esconde a descoberta (ela não é sorteada).
        texto: r.vitoria
          ? feridos
          : r.destino === DESTINO_QG
            ? `${TEXTOS_QG.recuoComDescoberta}${r.feridos.length ? ` ${juntarNomes(r.feridos)} ${r.feridos.length > 1 ? 'voltaram feridos' : 'voltou ferido'}.` : ''}`
            : r.feridos.length
              ? `O grupo recuou; ${juntarNomes(r.feridos)} ${r.feridos.length > 1 ? 'voltaram feridos' : 'voltou ferido'}.`
              : 'O grupo recuou antes de achar algo.',
        saque,
      };
    });
}

// ---------- Eras ----------

export interface Objetivo {
  texto: string;
  feito: boolean;
  progresso: { atual: number; total: number } | null;
}

// ---------- Falha (Portão 18b) ----------

export interface DadosFalha {
  nivel: number;
  /** "Falha 2" */
  rotulo: string;
  lore: string;
  /** O que a Falha de agora faz, ou que ainda não faz nada (Falha 0). */
  agora: string;
  /** Na próxima ascensão: "Falha 2 → 3" e o que muda; null no máximo. */
  proximo: { titulo: string; efeitos: string[] } | null;
  /** No máximo: o aviso de que não sobe mais. */
  noMaximo: string | null;
}

const pct = (porNivel: number, niveis: number) => Math.round(porNivel * 100 * niveis);
const nomesAfetadas = () => juntarNomes(FALHA.pesquisasAfetadas.map((id) => PESQUISAS[id].nome));

/** Efeitos da Falha num nível, em frases curtas (a Cripta só entra quando o acréscimo dela não for 0). */
function efeitosNoNivel(nivel: number): string[] {
  const efeitos = [`Obras e pesquisas ${pct(FALHA.tempoPorNivel, nivel)}% mais lentas`, `${nomesAfetadas()} ${pct(FALHA.custoPesquisaPorNivel, nivel)}% mais caras`];
  if (FALHA.perigoPorNivel > 0) efeitos.push(`${DESTINOS[FALHA.destinoAfetado].nome} de perigo ${perigoDestino(FALHA.destinoAfetado, nivel)}`);
  return efeitos;
}

export function dadosFalha(e: VisaoCliente): DadosFalha {
  const nivel = e.falha;
  const noMaximo = nivel >= FALHA.nivelMaximo;
  return {
    nivel,
    rotulo: `Falha ${nivel}`,
    lore: TEXTOS_FALHA.lore,
    agora: nivel === 0 ? 'Ainda sem efeito: o Relógio corre como sempre.' : `${efeitosNoNivel(nivel).join('. ')}.`,
    proximo: noMaximo ? null : { titulo: `Ao ascender: Falha ${nivel} → ${nivel + 1}`, efeitos: efeitosNoNivel(nivel + 1) },
    noMaximo: noMaximo ? TEXTOS_FALHA.noMaximo : null,
  };
}

export function eraAtual(e: VisaoCliente) {
  const o = objetivosEra(e);
  const total = OBJETIVOS_ERA_1.aldeoesMinimos;
  const aldeoes = e.aldeoes.length;
  const objetivos: Objetivo[] = [
    { texto: `Pesquisar a ${PESQUISAS[OBJETIVOS_ERA_1.pesquisa].nome}`, feito: o.cartaReal, progresso: null },
    { texto: `Vencer a ${DESTINOS[OBJETIVOS_ERA_1.destinoVencido].nome}`, feito: o.criptaVencida, progresso: null },
    { texto: `Reunir ${total} aldeões (${aldeoes} agora)`, feito: o.aldeoes, progresso: { atual: Math.min(aldeoes, total), total } },
  ];
  return {
    titulo: textoEra(e.era),
    ciclo: `Ciclo ${e.ciclo}`,
    texto: ERAS[e.era - 1]?.texto ?? '',
    objetivos,
    podeAscender: o.todos,
    falha: dadosFalha(e),
  };
}

export interface CartaReliquia {
  id: ReliquiaId;
  nome: string;
  nivel: string;
  efeito: string;
  custo: string;
  pode: boolean;
  motivo: string | null;
}

export function reliquias(e: VisaoCliente): { titulo: string; cartas: CartaReliquia[] } {
  const disponiveis = e.reliquias.total - e.reliquias.gastas;
  const cartas = RELIQUIAS_IDS.map((id): CartaReliquia => {
    const d = RELIQUIAS[id];
    const nivel = nivelReliquia(e, id);
    const maximo = nivel >= d.nivelMaximo;
    const custo = custoReliquia(id, nivel);
    return {
      id,
      nome: d.nome,
      nivel: `${nivel} / ${d.nivelMaximo}`,
      efeito: `${maiuscula(d.efeito)}, por nível.`,
      custo: maximo ? 'Nível máximo' : `${custo} relíquia${custo === 1 ? '' : 's'}`,
      pode: !maximo && disponiveis >= custo,
      motivo: maximo ? 'Nível máximo' : disponiveis >= custo ? null : 'Relíquias insuficientes',
    };
  });
  return { titulo: `${disponiveis} disponíve${disponiveis === 1 ? 'l' : 'is'} · ${e.reliquias.total} no total`, cartas };
}

const SPRITE_ERA: Record<number, string> = { 2: 'castelo', 3: 'torre', 4: 'portal' };
const ROMANOS = ['I', 'II', 'III', 'IV'];

export function caminhoDoTempo(e: VisaoCliente) {
  return ERAS.filter((x) => x.numero > e.era).map((x) => ({
    numero: x.numero,
    titulo: textoEra(x.numero),
    texto: x.texto,
    sprite: { grupo: 'futuro', id: SPRITE_ERA[x.numero] ?? 'portal' } satisfies RefSprite,
    liberacao: `Liberada ao ascender da Era ${ROMANOS[x.numero - 2]}`,
  }));
}

/** Micro-unidades para unidades (para comparar com a tela nos testes). */
export const unidades = (micro: number) => micro / MICRO;
