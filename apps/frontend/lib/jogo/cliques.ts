// Teto de cliques e taxa de coleta (decisão do dono, 17/11: manter o limite e explicá-lo). O número vem dos dados do jogo.
import { FORMULAS } from '@cronarca/game-core';

/** Aviso completo, uma vez por visita. */
export const avisoLimiteCliques = (): string =>
  `Cada árvore ou pedra rende até ${FORMULAS.clique.porSegundoObjeto} cliques por segundo (e ${FORMULAS.clique.porSegundoUsuario} no total). Espalhe os cliques entre objetos diferentes.`;

/** Janela em que os cliques contam para a taxa: 1 s, a mesma capacidade dos baldes do servidor. */
export const JANELA_TAXA_MS = 1_000;

export interface TaxaDeColeta {
  /** Recurso por segundo (micro), já com o teto por objeto e o total do jogador. */
  microPorSegundo: number;
  /** A taxa bateu no teto (por objeto ou no total): o rótulo avisa "máx.". */
  noTeto: boolean;
}

/**
 * Mede o ritmo de cliques dos últimos 1000 ms por objeto e calcula quanto de recurso por segundo o jogador consegue:
 * min(cliques/s do objeto, teto por objeto), reduzido proporcionalmente se a soma passar do teto do jogador, vezes o
 * ganho por clique (que inclui as relíquias). Só usa o ritmo de clique e as regras do teto, não o ganho previsto por
 * lote (irregular): o número é estável e o máximo é exatamente o teto.
 */
export class MedidorDeCliques {
  private readonly porObjeto = new Map<string, number[]>();

  registrar(objeto: string, agora: number) {
    const lista = this.porObjeto.get(objeto) ?? [];
    lista.push(agora);
    this.porObjeto.set(objeto, lista);
    this.podar(agora);
  }

  private contar(objeto: string, agora: number): number {
    return (this.porObjeto.get(objeto) ?? []).filter((t) => t > agora - JANELA_TAXA_MS && t <= agora).length;
  }

  private podar(agora: number) {
    for (const [obj, lista] of this.porObjeto) {
      const viva = lista.filter((t) => t > agora - JANELA_TAXA_MS);
      if (viva.length === 0) this.porObjeto.delete(obj);
      else if (viva.length !== lista.length) this.porObjeto.set(obj, viva);
    }
  }

  taxa(objeto: string, agora: number, ganhoPorCliqueMicro: number): TaxaDeColeta {
    const C = FORMULAS.clique;
    const limitados = new Map<string, number>();
    for (const obj of this.porObjeto.keys()) limitados.set(obj, Math.min(this.contar(obj, agora), C.porSegundoObjeto));
    const soma = [...limitados.values()].reduce((a, b) => a + b, 0);
    const escala = soma > C.porSegundoUsuario ? C.porSegundoUsuario / soma : 1;
    const cliques = this.contar(objeto, agora);
    const proprio = Math.min(cliques, C.porSegundoObjeto) * escala;
    return { microPorSegundo: proprio * ganhoPorCliqueMicro, noTeto: cliques >= C.porSegundoObjeto || escala < 1 };
  }
}

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** "+5/s" ou "+5/s máx." (recurso por segundo; com relíquias pode ter casas decimais, ex.: "+6,25/s"). */
export function rotuloDaTaxa(t: TaxaDeColeta): string {
  return `+${numero.format(t.microPorSegundo / 1e6)}/s${t.noTeto ? ' máx.' : ''}`;
}
