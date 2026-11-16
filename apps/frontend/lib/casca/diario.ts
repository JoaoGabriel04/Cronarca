// Diário e prólogo na casca (Portão 16). Puro, testado sem navegador; o que é
// só do navegador (capítulos já abertos, prólogo visto neste aparelho) fica no
// localStorage, sempre com try/catch: sem ele, tudo funciona (só o ponto de
// "novo" volta a aparecer).

import { CAPITULOS, CAPITULOS_IDS, CONDICOES, type CapituloId, type VisaoCliente } from '@cronarca/game-core';

export interface LinhaDiario {
  id: CapituloId;
  /** Liberado: título e texto. Bloqueado: "?" e a dica neutra. */
  liberado: boolean;
  titulo: string;
  texto: string | null;
  dica: string | null;
  /** Liberado e ainda não aberto neste navegador. */
  novo: boolean;
}

/** Capítulos na ordem do Diário: os liberados com o texto; os bloqueados só com "?" e a dica. */
export function linhasDiario(e: Pick<VisaoCliente, 'diario'>, lidos: ReadonlySet<string>): LinhaDiario[] {
  return CAPITULOS_IDS.map((id) => {
    const c = CAPITULOS[id];
    const liberado = e.diario.includes(id);
    return liberado
      ? { id, liberado, titulo: c.titulo, texto: c.texto, dica: null, novo: !lidos.has(id) }
      : { id, liberado, titulo: '?', texto: null, dica: c.dica, novo: false };
  });
}

/** Quantos capítulos liberados ainda não foram abertos (ponto no botão Diário). */
export const novosNoDiario = (e: Pick<VisaoCliente, 'diario'>, lidos: ReadonlySet<string>) => e.diario.filter((id) => !lidos.has(id)).length;

/** O prólogo abre se o estado diz que não foi visto e este navegador também não o viu. */
export const deveAbrirPrologo = (e: Pick<VisaoCliente, 'prologoVisto'>, vistoNoNavegador: boolean) => !e.prologoVisto && !vistoNoNavegador;

// Reexporta as condições só para os testes da casca conferirem que nada ficou de fora.
export { CONDICOES };

const CHAVE_LIDOS = 'cronarca.diario.lidos';
const CHAVE_PROLOGO = 'cronarca.prologo.visto';

export function lerLidos(): Set<string> {
  try {
    const bruto = window.localStorage.getItem(CHAVE_LIDOS);
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function gravarLidos(lidos: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(CHAVE_LIDOS, JSON.stringify([...lidos]));
  } catch {
    // Sem armazenamento: o ponto de "novo" volta na próxima visita, nada mais.
  }
}

export function prologoVistoNoNavegador(): boolean {
  try {
    return window.localStorage.getItem(CHAVE_PROLOGO) === '1';
  } catch {
    return false;
  }
}

export function marcarPrologoNoNavegador(): void {
  try {
    window.localStorage.setItem(CHAVE_PROLOGO, '1');
  } catch {
    // O estado (prologoVisto) já garante que não abre de novo.
  }
}
