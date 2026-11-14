// Aritmética inteira e racional exata. Cliente e servidor precisam chegar ao
// mesmo número sempre, então a simulação não usa ponto flutuante nem
// Math.pow (que não é garantido igual entre motores JS).
//
// Unidades da simulação:
//   recursos  -> micro-unidades (1 unidade = 1_000_000)
//   taxas     -> milésimos de unidade por segundo
//   tempo     -> milissegundos
// Assim taxa (milésimos/s) × Δt (ms) = micro-unidades, sem resto.

export const MICRO = 1_000_000;
export const MILI = 1_000;
/** Pontos-base: 10_000 = 100%. */
export const BP = 10_000;

export interface Racional {
  n: bigint;
  d: bigint;
}

/** Converte um decimal dos arquivos de dados (ex.: 1.55) em fração exata (155/100). */
export function racional(x: number): Racional {
  if (!Number.isFinite(x)) throw new Error(`número inválido nos dados: ${x}`);
  const texto = String(x);
  if (/e/i.test(texto)) throw new Error(`use notação decimal nos dados: ${texto}`);
  const negativo = texto.startsWith('-');
  const [inteira = '0', fracao = ''] = (negativo ? texto.slice(1) : texto).split('.');
  const d = 10n ** BigInt(fracao.length);
  const n = BigInt(inteira + fracao) * (negativo ? -1n : 1n);
  return { n, d };
}

/** Arredonda n/d para o inteiro mais próximo, com o meio para cima (regra do handoff). */
export function arredondar(n: bigint, d: bigint): number {
  if (d <= 0n) throw new Error('denominador precisa ser positivo');
  // floor((2n + d) / 2d), com floor correto para negativos.
  const num = 2n * n + d;
  const den = 2n * d;
  let q = num / den;
  if (num % den !== 0n && num < 0n) q -= 1n;
  const r = Number(q);
  if (!Number.isSafeInteger(r)) throw new Error('resultado fora do intervalo seguro');
  return r;
}

/** x^k exato, k inteiro ≥ 0. */
export function potencia(x: Racional, k: number): Racional {
  if (!Number.isInteger(k) || k < 0) throw new Error(`expoente inválido: ${k}`);
  return { n: x.n ** BigInt(k), d: x.d ** BigInt(k) };
}

/** round(inteiro × fração). */
export function multiplicar(valor: number, x: Racional): number {
  return arredondar(BigInt(valor) * x.n, x.d);
}

/** Converte um número dos dados para inteiro na escala dada (ex.: 0.35 com MILI -> 350). */
export function escalar(x: number, escala: number): number {
  return multiplicar(escala, racional(x));
}

export const micro = (x: number) => escalar(x, MICRO);
export const mili = (x: number) => escalar(x, MILI);
export const bp = (x: number) => escalar(x, BP);

/** round(valor × (BP + bonusBp) / BP): aplica um bônus percentual. */
export function aplicarBonus(valor: number, bonusBp: number): number {
  return arredondar(BigInt(valor) * BigInt(BP + bonusBp), BigInt(BP));
}

/** round(valor × fracaoBp / BP). */
export function fracaoBp(valor: number, bpValor: number): number {
  return arredondar(BigInt(valor) * BigInt(bpValor), BigInt(BP));
}

/** Divisão inteira arredondando para cima (positivos). */
export function divTeto(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

export function limitar(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
