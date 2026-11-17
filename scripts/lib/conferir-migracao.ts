// Verificação offline da migração do save (Portão 20d-3): migra cada save em
// memória até o esquema atual e confere invariantes. Não grava nada (nem no
// banco, nem em arquivo). Usado por scripts/conferir-migracao.ts e testado em
// packages/game-core/test/conferir-migracao.test.ts.

import { isDeepStrictEqual } from 'node:util';
import {
  CLASSES, CLASSES_ANTIGAS, carregarEstado, liquidar, migrarEstado, validarEstado, VERSAO_ESQUEMA, type EstadoJogo,
} from '../../packages/game-core/src/index.ts';

/** Uma linha da tabela de saves, como o comando de dump a exporta. */
export interface SaveBruto {
  /** Identificador anônimo (os 10 primeiros caracteres de um hash do user_id). */
  id: string;
  rev?: number;
  versao_esquema: number;
  estado: unknown;
}

export interface ResultadoSave {
  id: string;
  versaoOrigem: number;
  violacoes: string[];
  aventureiros: number;
  expedicoes: number;
  /** Aventureiros por classe de origem e a classe que receberam. */
  conversoes: Record<string, number>;
}

export type Migrador = typeof migrarEstado;

type Objeto = Record<string, unknown>;
const igual = (a: unknown, b: unknown) => isDeepStrictEqual(a, b);

/** Campos que a migração nunca pode mudar (além das classes). */
const CAMPOS_INVARIANTES = ['recursos', 'slots', 'pesquisas', 'reliquias', 'ciclo', 'falha', 'expedicoes', 'relatorios'] as const;

/** Classe nova esperada para a classe gravada, ou null se ela não existe em nenhum esquema. */
/** Primeiro esquema com as classes novas (Portão 20a). */
const VERSAO_DAS_CLASSES_NOVAS = 9;

function classeEsperada(classe: unknown, versaoOrigem: number): string | null {
  if (typeof classe !== 'string') return null;
  // Desde o esquema 9 as classes já são as quatro novas; só os saves de antes (6 a 8) trazem os ids antigos.
  if (versaoOrigem >= VERSAO_DAS_CLASSES_NOVAS) return (CLASSES as readonly string[]).includes(classe) ? classe : null;
  return (CLASSES_ANTIGAS as Record<string, string>)[classe] ?? null;
}

/**
 * Confere um save. `migrar` é injetável só para os testes provarem que a
 * verificação pega uma migração defeituosa.
 */
export function conferirSave(save: SaveBruto, migrar: Migrador = migrarEstado): ResultadoSave {
  const violacoes: string[] = [];
  const v = (texto: string) => violacoes.push(texto);
  const r: ResultadoSave = { id: save.id, versaoOrigem: save.versao_esquema, violacoes, aventureiros: 0, expedicoes: 0, conversoes: {} };
  const origem = save.estado as Objeto;
  if (!origem || typeof origem !== 'object' || Array.isArray(origem)) {
    v('estado não é um objeto');
    return r;
  }
  // 1. Migra em memória (a migração não pode mexer no objeto de entrada).
  let migrado: { estado: unknown; versao: number };
  try {
    migrado = migrar(structuredClone(origem), save.versao_esquema);
  } catch (erro) {
    v(`a migração lançou erro: ${(erro as Error).message}`);
    return r;
  }
  if (migrado.versao !== VERSAO_ESQUEMA) v(`versão final ${migrado.versao}, esperado ${VERSAO_ESQUEMA}`);
  const m = migrado.estado as Objeto;
  if (m.versao !== VERSAO_ESQUEMA) v(`estado.versao é ${String(m.versao)}, esperado ${VERSAO_ESQUEMA}`);

  // 2. O esquema atual aceita o resultado.
  let valido: EstadoJogo;
  try {
    valido = validarEstado(m, migrado.versao);
  } catch (erro) {
    v(`esquema ${VERSAO_ESQUEMA} recusa o estado migrado: ${(erro as Error).message.slice(0, 200)}`);
    return r;
  }

  // 3. Aventureiros: mesmos ids, ordem, contagem e campos; só a classe muda (pelo mapeamento) e entra `alojado: false`.
  const antes = (origem.aventureiros ?? []) as Objeto[];
  const depois = valido.aventureiros as unknown as Objeto[];
  r.aventureiros = antes.length;
  if (antes.length !== depois.length) v(`aventureiros: ${antes.length} antes, ${depois.length} depois`);
  antes.forEach((a, i) => {
    const b = depois[i];
    if (!b) return;
    for (const campo of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (campo === 'classe') continue;
      // Esquema 11: o campo novo `alojado` entra como false (ninguém mora no QG ainda); nada mais muda.
      if (campo === 'alojado' && save.versao_esquema < 11) {
        if (b.alojado !== false) v(`aventureiro ${String(a.id)}: alojado deveria ser false depois da migração`);
        continue;
      }
      if (!igual(a[campo], b[campo])) v(`aventureiro ${String(a.id)}: campo ${campo} mudou (${JSON.stringify(a[campo])} → ${JSON.stringify(b[campo])})`);
    }
    const esperada = classeEsperada(a.classe, save.versao_esquema);
    if (esperada === null) v(`aventureiro ${String(a.id)}: classe desconhecida "${String(a.classe)}"`);
    else if (b.classe !== esperada) v(`aventureiro ${String(a.id)}: classe ${String(a.classe)} virou ${String(b.classe)}, esperado ${esperada}`);
    const chave = `${String(a.classe)} → ${String(b.classe)}`;
    r.conversoes[chave] = (r.conversoes[chave] ?? 0) + 1;
  });
  const restantes = depois.filter((a) => !(CLASSES as readonly string[]).includes(String(a.classe)));
  if (restantes.length) v(`${restantes.length} aventureiro(s) com classe antiga depois da migração`);
  if (new Set(depois.map((a) => a.id)).size !== depois.length) v('ids de aventureiro repetidos');

  // 4. O que não pode mudar: recursos, construções, pesquisas, relíquias, ciclo, Falha, expedições e relatórios.
  for (const campo of CAMPOS_INVARIANTES) {
    if (campo in origem) {
      if (!igual(origem[campo], (valido as unknown as Objeto)[campo])) v(`campo ${campo} mudou na migração`);
    } else if (campo === 'falha' && valido.falha !== 0) {
      v(`falha ausente no save de origem: esperado 0, veio ${valido.falha}`);
    }
  }
  // Save do esquema 8 em diante: todo o resto também fica idêntico e nada mais aparece de novo. O que muda por etapa:
  // 8 para 9 as classes (checado acima); 9 para 10 entra o `qg` (oculto, desde o instante do save); 10 para 11 cada
  // aventureiro ganha `alojado: false` e o `qg` ganha o nível (1 se já estava reerguido, senão 0).
  if (save.versao_esquema >= 8) {
    const antes = save.versao_esquema;
    const mudam = new Set(['versao', 'qg', ...(antes === 8 ? ['aventureiros'] : [])]);
    for (const campo of Object.keys(origem)) {
      if (mudam.has(campo)) continue;
      if (campo === 'aventureiros') {
        const esperados = (origem.aventureiros as Objeto[]).map((a) => ({ ...a, ...(antes < 11 ? { alojado: false } : {}) }));
        if (!igual(esperados, valido.aventureiros)) v(`save do esquema ${antes}: campo aventureiros mudou além de alojado: false`);
        continue;
      }
      if (!igual(origem[campo], (valido as unknown as Objeto)[campo])) v(`save do esquema ${antes}: campo ${campo} mudou`);
    }
    for (const campo of Object.keys(valido)) if (!(campo in origem) && !(campo === 'qg' && antes < 10)) v(`save do esquema ${antes}: campo novo ${campo}`);
  }
  if (save.versao_esquema < 11 && valido.aventureiros.some((a) => a.alojado !== false)) v('aventureiro alojado depois da migração: ninguém mora no QG ainda');
  if (save.versao_esquema < 10) {
    if (!igual(valido.qg, { estado: 'oculto', desde: valido.t, nivel: 0 })) v(`qg depois da migração: esperado oculto desde ${valido.t}, nível 0, veio ${JSON.stringify(valido.qg)}`);
  } else if (save.versao_esquema === 10) {
    const q = origem.qg as { estado: string; desde: number };
    if (!igual(valido.qg, { ...q, nivel: q.estado === 'reerguido' ? 1 : 0 })) v(`qg depois da migração do esquema 10: esperado ${JSON.stringify({ ...q, nivel: q.estado === 'reerguido' ? 1 : 0 })}, veio ${JSON.stringify(valido.qg)}`);
  }

  // 5. Expedições em andamento: o relatório que sai é o sorteado antes da migração, e a classe não influi nele.
  r.expedicoes = valido.expedicoes.length;
  if (valido.expedicoes.length > 0) {
    const alvo = Math.max(valido.t, ...valido.expedicoes.map((x) => x.fim)) + 1;
    const sombra = structuredClone(valido) as EstadoJogo;
    sombra.aventureiros.forEach((a, i) => { (a as { classe: string }).classe = String(antes[i]?.classe); });
    const migradoFim = liquidar(valido, alvo);
    const sombraFim = liquidar(sombra, alvo);
    const semClasse = (e: EstadoJogo) => ({ ...e, aventureiros: e.aventureiros.map(({ classe: _c, ...resto }) => resto) });
    if (!igual(semClasse(migradoFim), semClasse(sombraFim))) v('a volta das expedições difere entre o save migrado e o de classes antigas');
    // O relatório guarda nomes (não ids) e o instante do fim; o segredo guarda ids dos feridos.
    const nomes = (ids: readonly string[]) => ids.map((id) => valido.aventureiros.find((a) => a.id === id)?.nome ?? id);
    for (const exp of valido.expedicoes) {
      const secreto = (valido.segredo.resultados as Record<string, { vitoria: boolean; feridos: string[] } | undefined>)[exp.id];
      const rel = migradoFim.relatorios.find((x) => x.destino === exp.destino && x.em === exp.fim && igual(x.grupo, nomes(exp.grupo)));
      if (!secreto) v(`expedição ${exp.id}: sem resultado sorteado no segredo`);
      else if (!rel) v(`expedição ${exp.id}: o relatório não apareceu depois do fim`);
      else if (rel.vitoria !== secreto.vitoria || !igual(rel.feridos, nomes(secreto.feridos))) v(`expedição ${exp.id}: o relatório difere do resultado sorteado`);
    }
  }

  // 6. Idempotência: migrar de novo, carregar duas vezes e ir e voltar por JSON dão o mesmo estado.
  try {
    const de_novo = migrar(structuredClone(valido), valido.versao);
    if (de_novo.versao !== VERSAO_ESQUEMA || !igual(de_novo.estado, valido)) v('migrar o estado já migrado mudou o estado (não é idempotente)');
    const c1 = carregarEstado(structuredClone(origem), save.versao_esquema);
    const c2 = carregarEstado(structuredClone(origem), save.versao_esquema);
    if (!igual(c1, c2) || !igual(c1, valido)) v('carregar duas vezes deu estados diferentes');
    const ida_e_volta = carregarEstado(JSON.parse(JSON.stringify(valido)), VERSAO_ESQUEMA);
    if (!igual(ida_e_volta, valido)) v('o estado migrado não sobrevive à ida e volta por JSON');
  } catch (erro) {
    v(`falha ao conferir a idempotência: ${(erro as Error).message.slice(0, 200)}`);
  }
  return r;
}

export interface RelatorioMigracao {
  total: number;
  ok: number;
  falhas: ResultadoSave[];
  resultados: ResultadoSave[];
  texto: string;
}

/** Confere todos os saves e monta o relatório (contagens, OK, falhas com o id do save). */
export function conferirSaves(saves: readonly SaveBruto[], opcoes: { sintetico?: boolean; migrar?: Migrador } = {}): RelatorioMigracao {
  const resultados = saves.map((s) => conferirSave(s, opcoes.migrar));
  const falhas = resultados.filter((x) => x.violacoes.length > 0);
  const porVersao: Record<number, number> = {};
  for (const s of saves) porVersao[s.versao_esquema] = (porVersao[s.versao_esquema] ?? 0) + 1;
  const conversoes: Record<string, number> = {};
  for (const x of resultados) for (const [k, n] of Object.entries(x.conversoes)) conversoes[k] = (conversoes[k] ?? 0) + n;
  const L: string[] = [];
  if (opcoes.sintetico) {
    L.push('*** SAVES SINTÉTICOS: gerados pelo código antigo (esquema 8). Isto NÃO substitui a conferência do dump real de produção. ***', '');
  }
  L.push(`Migração para o esquema ${VERSAO_ESQUEMA}: verificação offline (em memória; nada é gravado).`);
  L.push(`Saves lidos: ${saves.length}`);
  L.push(`Por versão de origem: ${Object.entries(porVersao).sort().map(([k, n]) => `v${k}: ${n}`).join(', ') || 'nenhum'}`);
  L.push(`Aventureiros: ${resultados.reduce((s, x) => s + x.aventureiros, 0)}; expedições em andamento: ${resultados.reduce((s, x) => s + x.expedicoes, 0)}`);
  L.push(`Conversões de classe: ${Object.entries(conversoes).sort().map(([k, n]) => `${k}: ${n}`).join('; ') || 'nenhuma'}`);
  L.push(`OK: ${resultados.length - falhas.length} | Falhas: ${falhas.length}`);
  for (const f of falhas) {
    L.push(`  FALHOU save ${f.id} (v${f.versaoOrigem}):`);
    for (const viol of f.violacoes.slice(0, 10)) L.push(`    - ${viol}`);
    if (f.violacoes.length > 10) L.push(`    ... e mais ${f.violacoes.length - 10}`);
  }
  if (falhas.length === 0 && saves.length > 0) L.push('Todos os saves migram sem perda: classes convertidas, o resto idêntico, idempotente.');
  return { total: saves.length, ok: resultados.length - falhas.length, falhas, resultados, texto: L.join('\n') };
}

/** Lê o conteúdo de um dump: um array de saves, ou { saves: [...] } (o formato das fixtures). */
export function lerSaves(conteudo: string): { saves: SaveBruto[]; sintetico: boolean } {
  const bruto: unknown = JSON.parse(conteudo);
  const lista = Array.isArray(bruto) ? bruto : (bruto as { saves?: unknown }).saves;
  if (!Array.isArray(lista)) throw new Error('formato inesperado: esperado um array de saves ou { saves: [...] }');
  const saves = lista.map((s, i) => {
    const o = s as Partial<SaveBruto>;
    if (typeof o.id !== 'string' || typeof o.versao_esquema !== 'number' || o.estado === undefined) throw new Error(`save #${i} sem id, versao_esquema ou estado`);
    return o as SaveBruto;
  });
  const sintetico = !Array.isArray(bruto) && (bruto as { sintetico?: boolean }).sintetico === true;
  return { saves, sintetico };
}
