// Gerador pseudoaleatório determinístico (mulberry32), só com operações
// inteiras de 32 bits. O estado do gerador fica na parte secreta do estado
// do jogo: o cliente nunca o recebe, senão saberia o resultado dos sorteios.

export interface Sorteador {
  /** Estado interno atual (uint32), para gravar de volta no estado do jogo. */
  readonly estado: number;
  /** Inteiro uniforme em [min, max], inclusive. */
  inteiro(min: number, max: number): number;
  /** true com probabilidade chanceBp / 10_000. */
  chance(chanceBp: number): boolean;
  /** Um item da lista, uniforme. */
  escolher<T>(itens: readonly T[]): T;
}

function proximo(s: number): [valor: number, novo: number] {
  const novo = (s + 0x6d2b79f5) | 0;
  let t = novo;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [(t ^ (t >>> 14)) >>> 0, novo >>> 0];
}

export function criarSorteador(semente: number): Sorteador {
  let s = semente >>> 0;
  const u32 = () => {
    const [v, n] = proximo(s);
    s = n;
    return v;
  };
  // Inteiro uniforme em [0, n) sem viés (rejeição).
  const abaixoDe = (n: number) => {
    if (!Number.isInteger(n) || n <= 0 || n > 0x1_0000_0000) throw new Error(`intervalo inválido: ${n}`);
    const limite = 0x1_0000_0000 - (0x1_0000_0000 % n);
    let v = u32();
    while (v >= limite) v = u32();
    return v % n;
  };
  return {
    get estado() {
      return s;
    },
    inteiro: (min, max) => min + abaixoDe(max - min + 1),
    chance: (chanceBp) => abaixoDe(10_000) < chanceBp,
    escolher: (itens) => {
      if (itens.length === 0) throw new Error('lista vazia');
      return itens[abaixoDe(itens.length)]!;
    },
  };
}
