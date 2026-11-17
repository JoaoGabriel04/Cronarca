// Diário (Portão 16): capítulos da lore liberados por condições do estado.
// A liberação é determinística e acontece na liquidação (obra, pesquisa,
// Cripta, chegada de aldeão) e na ascensão, então a previsão do cliente faz
// igual ao servidor. Cada liberação escreve uma linha na Crônica e não dá
// recompensa. O Diário atravessa a ascensão (a história lida não se perde).
//
// Para acrescentar um capítulo (ex.: Portão 21): o texto em data/lore.ts e a
// condição aqui, em CONDICOES. Ids nunca são apagados.

import { OBJETIVOS_ERA_1 } from '../data/eras.ts';
import { CAPITULOS, CAPITULOS_IDS, textoNovaPagina, type CapituloId } from '../data/lore.ts';
import { registrar } from './cronica.ts';
import type { EstadoJogo, VisaoCliente } from './estado.ts';
import { somaNiveis } from './regras.ts';

/** `qg` é opcional na entrada: a migração do Diário (esquema 7 para 8) roda sobre saves que ainda não o têm. */
type Condicao = (e: Pick<VisaoCliente, 'slots' | 'pesquisas' | 'objetivos' | 'aldeoes' | 'ciclo' | 'falha'> & { qg?: VisaoCliente['qg'] }) => boolean;

/** Quando cada capítulo libera. */
export const CONDICOES: Record<CapituloId, Condicao> = {
  prologo: () => true,
  scriptorium: (e) => somaNiveis(e, 'scriptorium') >= 1,
  quartel_general: (e) => (e.qg?.estado ?? 'oculto') !== 'oculto',
  cartografia: (e) => e.pesquisas.concluidas.includes('cartografia'),
  estradas_reais: (e) => e.pesquisas.concluidas.includes('estradas_reais'),
  carta_real: (e) => e.pesquisas.concluidas.includes('carta_real'),
  cripta_vencida: (e) => e.objetivos.criptaVencida,
  aldeoes_40: (e) => e.aldeoes.length >= OBJETIVOS_ERA_1.aldeoesMinimos,
  primeira_ascensao: (e) => e.ciclo >= 2,
  falha_3: (e) => e.falha >= 3,
};

/** Capítulos da Era I: quem já ascendeu passou por todos (ascender exige os três objetivos). */
export const CAPITULOS_DA_ERA_1: readonly CapituloId[] = ['scriptorium', 'cartografia', 'estradas_reais', 'carta_real', 'cripta_vencida', 'aldeoes_40'];

/** Libera, na ordem do Diário, os capítulos cujas condições valem agora; uma linha na Crônica por capítulo. */
export function liberarCapitulos(e: EstadoJogo, t: number): void {
  for (const id of CAPITULOS_IDS) {
    if (e.diario.includes(id) || !CONDICOES[id](e)) continue;
    e.diario.push(id);
    registrar(e, 'Diario', textoNovaPagina(CAPITULOS[id].titulo), t);
  }
}

/** Diário de um save antigo (migração para o esquema 8): o que já vale hoje, mais a Era I de quem já ascendeu. */
export function diarioDaMigracao(e: Parameters<Condicao>[0]): CapituloId[] {
  return CAPITULOS_IDS.filter((id) => CONDICOES[id](e) || (e.ciclo >= 2 && CAPITULOS_DA_ERA_1.includes(id)));
}
