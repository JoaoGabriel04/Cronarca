// Dados que a casca mostra (Portão 11): tudo derivado do estado e das regras
// do game-core, sem número fixo aqui. Funções puras, testadas sem navegador.

import {
  CONSTRUCOES, custoConstrucao, DESTINOS, DESTINOS_IDS, destinoAberto, duracaoExpedicaoMs, ERAS, FAIXAS_PERIGO,
  calcularTaxas, MICRO, NIVEL_MAXIMO_CONSTRUCAO, NOMES_RECURSOS, nivelReliquia, PESQUISAS, RECURSOS, SLOT_IDS, SLOTS, somaNiveis, tetoMicro, tetos,
  type DestinoId, type IconeCronica, type Recurso, type RefSprite, type SlotId, type VisaoCliente,
  aldeoesMaximos, aldeaoAtivo, FORMULAS, NOME_OCIOSO, NOMES_OFICIOS, NOMES_POLITICAS, OFICIO_OCIOSO, OFICIOS, OFICIOS_ALDEAO,
  POLITICAS_PRONTAS, type Oficio, type OficioAldeao, type PoliticaAldeoes, type PoliticaPronta, type TipoConstrucao,
} from '@cronarca/game-core';

const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** Quantidade inteira em PT-BR ("1.284"); a fração fica para trás (o HUD mostra unidades). */
export const formatarInteiro = (micro: number) => inteiro.format(Math.floor(micro / MICRO));

/** Taxa por segundo a partir de milésimos/s ("+12/s", "+0,12/s", "−3/s"). */
export function formatarTaxa(miliPorSegundo: number): string {
  const v = miliPorSegundo / 1000;
  const sinal = v < 0 ? '−' : '+';
  return `${sinal}${decimal.format(Math.abs(v))}/s`;
}

/** mm:ss (ou h:mm:ss) de um tempo restante. */
export function formatarRestante(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

/** Hora local HH:MM de uma linha da Crônica. */
export const formatarHora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const ROMANOS = ['I', 'II', 'III', 'IV'];
export const textoEra = (era: number) => `Era ${ROMANOS[era - 1] ?? era} · ${ERAS[era - 1]?.nome ?? ''}`;

// ---------- HUD ----------

export interface ChipRecurso {
  recurso: Recurso;
  quantidade: string;
  taxa: string;
  negativa: boolean;
  cheio: boolean;
  /** Comida em 0 e sem subir: destaque e a dica do que fazer. */
  alerta: string | null;
}

export function chipsHud(e: VisaoCliente): ChipRecurso[] {
  const { saldo } = calcularTaxas(e);
  const teto = tetos(e);
  return RECURSOS.map((r) => ({
    recurso: r,
    quantidade: formatarInteiro(e.recursos[r]),
    taxa: formatarTaxa(saldo[r]),
    negativa: saldo[r] < 0,
    cheio: e.recursos[r] >= teto[r],
    alerta:
      r === 'comida' && e.recursos.comida <= 0 && saldo.comida <= 0
        ? 'Sem comida: expedições não partem. Pesquise Colheita Farta ou melhore a Casa (com a comida em 0 chegam Fazendeiros).'
        : null,
  }));
}

// ---------- Construções ----------

export interface CartaConstrucao {
  slot: SlotId;
  nome: string;
  /** Sprite animado da construção (quadros.json). */
  sprite: RefSprite;
  nivel: number;
  efeito: string;
  /** Custo do próximo nível (vazio em obra e no nível máximo). */
  custo: { recurso: Recurso; valor: string }[];
  situacao: 'pronta' | 'obra' | 'maximo';
  restante: string | null;
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function efeitoDe(e: VisaoCliente, slot: SlotId): string {
  const tipo = SLOTS[slot].tipo;
  const dados = CONSTRUCOES[tipo];
  const nivel = Math.max(1, e.slots[slot].nivel);
  if (dados.producao) return `Produz ${decimal.format(dados.producao.porSegundo * nivel)} ${dados.producao.recurso}/s`;
  if (tipo === 'armazem') return `Guarda ${formatarInteiro(tetoMicro(somaNiveis(e, 'armazem')))} de cada recurso`;
  if (tipo === 'celeiro') return `Guarda ${formatarInteiro(tetoMicro(somaNiveis(e, 'celeiro')))} de comida`;
  return maiuscula(dados.efeito);
}

/** Construções de pé e em obra, na ordem dos slots. */
export function cartasConstrucoes(e: VisaoCliente, agora: number): { titulo: string; cartas: CartaConstrucao[] } {
  const cartas: CartaConstrucao[] = [];
  for (const slot of SLOT_IDS) {
    const s = e.slots[slot];
    if (s.nivel < 1 && s.obraAte === null) continue;
    const tipo = SLOTS[slot].tipo;
    const emObra = s.obraAte !== null;
    const maximo = s.nivel >= NIVEL_MAXIMO_CONSTRUCAO;
    // Custo do próximo nível; em obra mostra o tempo restante no lugar, e no máximo não há próximo.
    const custo = emObra || maximo ? [] : (Object.entries(custoConstrucao(tipo, s.nivel + 1)) as [Recurso, number][]).map(([recurso, v]) => ({ recurso, valor: formatarInteiro(v) }));
    cartas.push({
      slot,
      nome: CONSTRUCOES[tipo].nome,
      sprite: { grupo: 'construcao', id: tipo },
      nivel: s.nivel,
      efeito: efeitoDe(e, slot),
      custo,
      situacao: emObra ? 'obra' : maximo ? 'maximo' : 'pronta',
      restante: emObra ? formatarRestante(s.obraAte! - agora) : null,
    });
  }
  const construidas = SLOT_IDS.filter((id) => e.slots[id].nivel >= 1).length;
  return { titulo: `${construidas} de ${SLOT_IDS.length} construídas`, cartas };
}

// ---------- Destinos ----------

export interface CartaDestino {
  destino: DestinoId;
  nome: string;
  linha: string;
  /** Linha em destaque (vermelha): expedição em andamento. */
  emAndamento: boolean;
  saque: Recurso[];
  botao: 'ver' | 'enviar' | 'bloqueada';
  nevoa: boolean;
}

export const faixaDePerigo = (perigo: number) => FAIXAS_PERIGO.find((f) => perigo <= f.ate)!.nome;

export function cartasDestinos(e: VisaoCliente, agora: number): { titulo: string; cartas: CartaDestino[] } {
  const cartas = DESTINOS_IDS.map((id): CartaDestino => {
    const d = DESTINOS[id];
    const saque = (Object.keys(d.saque) as Recurso[]).filter((r) => RECURSOS.includes(r));
    const exp = e.expedicoes.filter((x) => x.destino === id).sort((a, b) => a.fim - b.fim)[0];
    if (exp) return { destino: id, nome: d.nome, linha: `Em andamento · ${formatarRestante(exp.fim - agora)}`, emAndamento: true, saque, botao: 'ver', nevoa: false };
    if (!destinoAberto(e, id)) {
      return { destino: id, nome: d.nome, linha: `Requer ${PESQUISAS[d.requer!].nome}`, emAndamento: false, saque, botao: 'bloqueada', nevoa: id === 'cripta' };
    }
    const duracao = duracaoExpedicaoMs(id, nivelReliquia(e, 'caminhos_eternos'));
    return { destino: id, nome: d.nome, linha: `Perigo ${faixaDePerigo(d.perigo)} · ${formatarRestante(duracao)}`, emAndamento: false, saque, botao: 'enviar', nevoa: false };
  });
  const n = e.expedicoes.length;
  return { titulo: n === 0 ? 'Nenhum grupo em expedição' : n === 1 ? '1 grupo em expedição' : `${n} grupos em expedição`, cartas };
}

// ---------- Crônica ----------

export interface LinhaCronica {
  icone: string;
  texto: string;
  hora: string;
  chave: string;
}

const ICONE: Record<IconeCronica, string> = {
  Check: 'check', Construir: 'construir', Expedicao: 'expedicao', Evento: 'evento', Aldeao: 'aldeao', Aventureiro: 'aventureiro',
  Reliquia: 'reliquia', Ascensao: 'ascensao', Alerta: 'alerta', Tempo: 'tempo', Saber: 'saber', Ouro: 'ouro',
};

/** As `n` linhas mais recentes, da mais nova para a mais velha. */
export function linhasCronica(e: VisaoCliente, n: number): LinhaCronica[] {
  return e.cronica
    .map((l, i) => ({ l, i }))
    .slice(-n)
    .reverse()
    .map(({ l, i }) => ({ icone: `icone-${ICONE[l.icone as IconeCronica] ?? "evento"}`, texto: l.texto, hora: formatarHora(l.em), chave: `${l.em}-${i}` }));
}

// ---------- Evento (Mercador) ----------

/** Uma linha da troca: recurso, quantidade e, no que se paga, se falta. */
export interface ItemTroca {
  recurso: Recurso;
  quantidade: string;
  /** Só no que se paga: o jogador não tem o suficiente agora. */
  falta: boolean;
  /** Quanto o jogador tem agora (para "você tem 62"). */
  tem: string;
}

export interface DadosMercador {
  restante: string;
  /** O que o jogador recebe se aceitar. */
  recebe: ItemTroca[];
  /** O que o jogador paga se aceitar. */
  paga: ItemTroca[];
  /** Dá para aceitar agora? (o servidor confere de novo). */
  pode: boolean;
  /** Por que não dá ("Falta madeira: você tem 62 de 100."), ou null. */
  motivo: string | null;
  /** Resumo curto para o chip: "100 madeira por 15 ouro". */
  resumo: string;
  /** O que acontece se recusar ou o tempo acabar. */
  consequencia: string;
}

function itensDaTroca(t: Partial<Record<Recurso, number>>, e: VisaoCliente, pagando: boolean): ItemTroca[] {
  return RECURSOS.filter((r) => (t[r] ?? 0) > 0).map((r) => ({
    recurso: r,
    quantidade: formatarInteiro(t[r]!),
    falta: pagando && e.recursos[r] < t[r]!,
    tem: formatarInteiro(e.recursos[r]),
  }));
}

const textoItens = (itens: ItemTroca[]) => itens.map((i) => `${i.quantidade} ${NOMES_RECURSOS[i.recurso].toLowerCase()}`).join(' e ');

/**
 * Mercador Viajante pendente: os termos vêm do evento que o servidor gravou
 * (estado.mercador), nunca de constante do cliente. null se não há ou expirou.
 */
export function dadosMercador(e: VisaoCliente, agora: number): DadosMercador | null {
  if (!e.mercador || e.mercador.expiraEm <= agora) return null;
  const recebe = itensDaTroca(e.mercador.recebe, e, false);
  const paga = itensDaTroca(e.mercador.paga, e, true);
  const faltando = paga.filter((i) => i.falta);
  const motivo = faltando.length === 0
    ? null
    : faltando.map((i) => `Falta ${NOMES_RECURSOS[i.recurso].toLowerCase()}: você tem ${i.tem} de ${i.quantidade}.`).join(' ');
  return {
    restante: formatarRestante(e.mercador.expiraEm - agora),
    recebe,
    paga,
    pode: faltando.length === 0,
    motivo,
    resumo: `${textoItens(paga)} por ${textoItens(recebe)}`,
    consequencia: 'Se recusar ou o tempo acabar, o Mercador segue viagem e nada muda.',
  };
}

// ---------- "Salvo há" ----------

export interface Sincronia {
  /** Instante local da última confirmação do servidor (null: nenhuma ainda). */
  confirmadoEm: number | null;
  pendentes: number;
  semConexao: boolean;
}

export function textoSalvo(s: Sincronia, agoraLocal: number): { texto: string; icone: 'check' | 'tempo' | 'alerta' } {
  if (s.semConexao) return { texto: 'Sem conexão', icone: 'alerta' };
  if (s.pendentes > 0) return { texto: 'Salvando...', icone: 'tempo' };
  if (s.confirmadoEm === null) return { texto: 'Conectando...', icone: 'tempo' };
  const seg = Math.max(0, Math.floor((agoraLocal - s.confirmadoEm) / 1000));
  if (seg < 60) return { texto: `Salvo há ${seg}s`, icone: 'check' };
  const min = Math.floor(seg / 60);
  return { texto: `Salvo há ${min} min`, icone: 'check' };
}

// ---------- Aldeões (cartão da Vila) ----------

/** Recurso que o ofício melhora (+5% cada) e a construção que produz esse recurso. */
const BONUS_DO_OFICIO: Partial<Record<Oficio, { recurso: Recurso; produtora: TipoConstrucao }>> = {
  lenhador: { recurso: 'madeira', produtora: 'serraria' },
  mineiro: { recurso: 'pedra', produtora: 'pedreira' },
  sabio: { recurso: 'saber', produtora: 'scriptorium' },
  ferreiro: { recurso: 'ferro', produtora: 'forja' },
};

export interface LinhaOficio {
  oficio: OficioAldeao;
  nome: string;
  /** Todos no ofício, contando os que ainda estão a caminho. */
  quantidade: number;
  /** Mudaram para cá e ainda não produzem (deslocamento). */
  aCaminho: number;
  /** "+0,7 comida/s", "+10% de madeira", "Não produz, mas come" ou o que falta para render. */
  efeito: string;
  /** Sem efeito agora (Ocioso, falta a construção ou a comida zerou). */
  parado: boolean;
  /** "+": tira um do Ocioso para este ofício. Nunca na linha do Ocioso. */
  podeMais: boolean;
  /** "−": manda um deste ofício para o Ocioso. Nunca na linha do Ocioso. */
  podeMenos: boolean;
}

export interface OpcaoPolitica {
  politica: PoliticaAldeoes;
  nome: string;
  /** "Manter proporção atual" aparece só quando é a atual e não se escolhe. */
  escolhivel: boolean;
}

export interface DadosAldeoes {
  total: number;
  maximo: number;
  /** "Próximo em 12 s", "Casas cheias: melhore a Casa", "Sem comida: ninguém chega". */
  situacao: string;
  /** Cheio ou sem comida: o texto da situação vai em destaque. */
  alerta: boolean;
  /** Os cinco ofícios e o Ocioso, sempre nessa ordem. */
  oficios: LinhaOficio[];
  automatica: boolean;
  politica: PoliticaAldeoes;
  politicas: OpcaoPolitica[];
  /** Automática desligada: "Aldeões novos chegam ociosos". */
  aviso: string | null;
}

const nomeRecurso = (r: Recurso) => NOMES_RECURSOS[r].toLowerCase();

function efeitoDoOficio(e: VisaoCliente, oficio: Oficio, ativos: number, temComida: boolean): { efeito: string; parado: boolean } {
  if (oficio === 'fazendeiro') return { efeito: `+${decimal.format(FORMULAS.aldeoes.comidaDoFazendeiro * ativos)} comida/s`, parado: ativos === 0 };
  const b = BONUS_DO_OFICIO[oficio]!;
  const bonus = `+${Math.round(FORMULAS.aldeoes.bonusPorOficio * ativos * 100)}% de ${nomeRecurso(b.recurso)}`;
  if (ativos === 0) return { efeito: bonus, parado: true };
  if (!temComida) return { efeito: `${bonus} (parado sem comida)`, parado: true };
  if (somaNiveis(e, b.produtora) === 0) return { efeito: `${bonus} quando houver ${CONSTRUCOES[b.produtora].nome}`, parado: true };
  return { efeito: bonus, parado: false };
}

/** Quantos aldeões, quantos cabem, quando chega o próximo, o que cada ofício faz agora e a distribuição automática. */
export function dadosAldeoes(e: VisaoCliente): DadosAldeoes {
  const total = e.aldeoes.length;
  const maximo = aldeoesMaximos(e);
  const temComida = e.recursos.comida > 0;
  const config = e.aldeoesConfig;
  const segundos = Math.max(1, Math.ceil((FORMULAS.aldeoes.segundosPorChegada * 1000 - e.progressoAldeaoMs) / 1000));
  let situacao: string;
  if (!temComida && total >= maximo) situacao = 'Sem comida e Casas cheias: pesquise Colheita Farta ou melhore a Casa';
  else if (!temComida) situacao = `Sem comida: os ofícios param e o próximo, em ${segundos} s, chega como Fazendeiro`;
  else if (total >= maximo) situacao = 'Casas cheias: melhore a Casa para chegarem mais';
  else situacao = `Próximo em ${segundos} s`;

  const ociosos = e.aldeoes.filter((a) => a.oficio === OFICIO_OCIOSO).length;
  const oficios = OFICIOS_ALDEAO.map((oficio): LinhaOficio => {
    const doOficio = e.aldeoes.filter((a) => a.oficio === oficio);
    const quantidade = doOficio.length;
    if (oficio === OFICIO_OCIOSO) {
      return { oficio, nome: NOME_OCIOSO, quantidade, aCaminho: 0, efeito: 'Não produz, mas come', parado: true, podeMais: false, podeMenos: false };
    }
    const ativos = doOficio.filter((a) => aldeaoAtivo(a, e.t)).length;
    return {
      oficio, nome: NOMES_OFICIOS[oficio], quantidade, aCaminho: quantidade - ativos,
      ...efeitoDoOficio(e, oficio, ativos, temComida),
      podeMais: ociosos > 0, podeMenos: quantidade > 0,
    };
  });

  const politicas: OpcaoPolitica[] = POLITICAS_PRONTAS.map((p: PoliticaPronta) => ({ politica: p, nome: NOMES_POLITICAS[p], escolhivel: true }));
  if (config.politica === 'manter') politicas.push({ politica: 'manter', nome: NOMES_POLITICAS.manter, escolhivel: false });

  return {
    total, maximo, situacao, alerta: !temComida || total >= maximo, oficios,
    automatica: config.automatica, politica: config.politica, politicas,
    aviso: config.automatica ? null : 'Aldeões novos chegam ociosos',
  };
}
