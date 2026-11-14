// Tempos da sincronização com o servidor (Portão 10). Não são números de
// economia: são de rede e de interface, por isso ficam no cliente.

export const SINCRONIA = {
  /** SWR: pede o estado de novo a cada 30 s com a aba visível (pega eventos, cuja hora é secreta). */
  atualizarMs: 30_000,
  /** Sem resposta do servidor em 10 s: a ação dá erro visível e o botão destrava. */
  tempoLimiteAcaoMs: 10_000,
  /** Cliques no mesmo objeto dentro desta janela viram um lote só ({ tipo: 'clicar', quantidade }). */
  loteCliquesMs: 250,
  /** Ações previstas (cliques, obras) tentam de novo sozinhas, com a mesma chave, até este número de vezes. */
  tentativasRede: 3,
  /** Espera entre tentativas por queda de rede. */
  esperaRedeMs: 1_000,
  /** Margem depois do fim de uma expedição para pedir o estado com a volta já resolvida. */
  margemFimExpedicaoMs: 500,
} as const;

export const CARREGAMENTO = {
  /** A tela de carregamento só aparece se demorar mais que isto (não pisca em conexão rápida). */
  mostrarApósMs: 300,
  /** Passou disto: troca o texto pela mensagem de erro com "Tentar de novo". */
  desistirApósMs: 10_000,
} as const;
