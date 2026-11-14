// Dados que a casca mostra (Portão 11): tudo derivado do estado e das regras
// do game-core, sem número fixo aqui. Funções puras, testadas sem navegador.

import {
  CONSTRUCOES, custoConstrucao, DESTINOS, DESTINOS_IDS, destinoAberto, duracaoExpedicaoMs, ERAS, FAIXAS_PERIGO,
  calcularTaxas, MICRO, NIVEL_MAXIMO_CONSTRUCAO, nivelReliquia, PESQUISAS, RECURSOS, SLOT_IDS, SLOTS, somaNiveis, tetoMicro, tetos,
  type DestinoId, type IconeCronica, type Recurso, type RefSprite, type SlotId, type VisaoCliente,
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

export function mercadorAtivo(e: VisaoCliente, agora: number): { restante: string } | null {
  if (!e.mercador || e.mercador.expiraEm <= agora) return null;
  return { restante: formatarRestante(e.mercador.expiraEm - agora) };
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
