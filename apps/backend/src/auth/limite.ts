// Limite de tentativas em janela fixa, guardado em memória. Basta enquanto
// o backend roda numa instância só; com várias, passa para o banco ou Redis.

interface Contador {
  tentativas: number;
  reiniciaEm: number;
}

export interface ResultadoLimite {
  permitido: boolean;
  /** Segundos até a janela reabrir (só quando bloqueado). */
  esperarS: number;
}

export class LimiteTentativas {
  private readonly contadores = new Map<string, Contador>();

  constructor(
    private readonly janelaMs: number,
    private readonly maximo: number,
    private readonly agora: () => number = Date.now,
  ) {}

  /** Diz se a chave ainda pode tentar, sem contar uma tentativa. */
  consultar(chave: string): ResultadoLimite {
    const c = this.vigente(chave);
    if (c && c.tentativas >= this.maximo) {
      return { permitido: false, esperarS: Math.ceil((c.reiniciaEm - this.agora()) / 1000) };
    }
    return { permitido: true, esperarS: 0 };
  }

  registrar(chave: string): void {
    const c = this.vigente(chave);
    if (c) {
      c.tentativas += 1;
    } else {
      this.contadores.set(chave, { tentativas: 1, reiniciaEm: this.agora() + this.janelaMs });
      this.limparVencidos();
    }
  }

  zerar(chave: string): void {
    this.contadores.delete(chave);
  }

  private vigente(chave: string): Contador | undefined {
    const c = this.contadores.get(chave);
    if (c && c.reiniciaEm <= this.agora()) {
      this.contadores.delete(chave);
      return undefined;
    }
    return c;
  }

  private limparVencidos() {
    if (this.contadores.size < 10_000) return;
    const agora = this.agora();
    for (const [chave, c] of this.contadores) {
      if (c.reiniciaEm <= agora) this.contadores.delete(chave);
    }
  }
}
