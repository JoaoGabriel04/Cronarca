import { FORMULAS } from '../data/formulas.ts';
import { MICRO } from './inteiros.ts';
import type { EstadoJogo } from './estado.ts';

/** Ícones da Crônica: nomes do component set Sprite/Icone do Figma. */
export type IconeCronica =
  | 'Check' | 'Construir' | 'Expedicao' | 'Evento' | 'Aldeao' | 'Aventureiro'
  | 'Reliquia' | 'Ascensao' | 'Alerta' | 'Tempo' | 'Saber' | 'Ouro';

/** Acrescenta uma linha (a mais nova fica no fim) e descarta as mais antigas. */
export function registrar(e: EstadoJogo, icone: IconeCronica, texto: string, em: number) {
  e.cronica.push({ icone, texto, em });
  const excesso = e.cronica.length - FORMULAS.cronica.maximoDeLinhas;
  if (excesso > 0) e.cronica.splice(0, excesso);
}

/** Formata micro-unidades para texto, sem casas quando inteiro (ex.: 12, 0,4). */
export function formatarQuantidade(microUnidades: number): string {
  const milesimos = Math.floor(microUnidades / 1000);
  const inteira = Math.floor(milesimos / 1000);
  const fracao = milesimos % 1000;
  if (fracao === 0) return String(inteira);
  return `${inteira},${String(fracao).padStart(3, '0').replace(/0+$/, '')}`;
}

/**
 * Quantidade da Crônica: unidades inteiras (arredondadas) com ponto de milhar,
 * como o HUD ("1.284 madeira"). A fração fica só no estado e no "+N" do clique.
 */
export function formatarInteiro(microUnidades: number): string {
  const n = Math.round(microUnidades / MICRO);
  return String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.').replace(/^/, n < 0 ? '-' : '');
}
