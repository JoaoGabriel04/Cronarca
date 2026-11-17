// Texto de cada recusa do servidor (o código vem de ErroAcao, no game-core).
// Puro: usado pelo aviso e testado sem navegador.

import type { ErroAcao } from '@cronarca/game-core';

const TEXTOS: Record<ErroAcao, string> = {
  slot_ocupado: 'Esta construção já está em obra.',
  slot_ja_construido: 'Esta construção já existe.',
  slot_vazio: 'Construa primeiro para poder melhorar.',
  nivel_maximo: 'Já está no nível máximo.',
  recursos_insuficientes: 'Faltam recursos.',
  pesquisa_em_andamento: 'Já há uma pesquisa em andamento.',
  pesquisa_concluida: 'Esta pesquisa já foi concluída.',
  requisito_pendente: 'Falta a pesquisa anterior.',
  guilda_cheia: 'A guilda está cheia: melhore a Taverna para abrir vagas.',
  aventureiro_inexistente: 'Esse aventureiro não está mais na guilda.',
  aventureiro_indisponivel: 'Um aventureiro do grupo está ferido ou em outra expedição.',
  equipamento_maximo: 'O equipamento já está no máximo.',
  destino_bloqueado: 'Este destino ainda está bloqueado.',
  grupo_invalido: 'Escolha o grupo de novo.',
  sem_comida: 'Sem comida: a expedição não parte. Pesquise Colheita Farta ou melhore a Casa.',
  sem_mercador: 'O Mercador já seguiu viagem.',
  alocacao_invalida: 'Escolha um ofício diferente.',
  aldeoes_insuficientes: 'Não há aldeões suficientes nesse ofício.',
  reliquia_maxima: 'Esta relíquia já está no máximo.',
  reliquias_insuficientes: 'Faltam relíquias.',
  objetivos_pendentes: 'Cumpra os objetivos da era antes de ascender.',
  objeto_invalido: 'Não dá para coletar daí.',
  limite_cliques: 'Devagar: muitos cliques seguidos.',
  qg_indisponivel: 'O Quartel General não está disponível agora.',
};

/** Texto da recusa; um código desconhecido vira a mensagem genérica. */
export function textoDaRecusa(erro: string | undefined): string {
  return (erro && TEXTOS[erro as ErroAcao]) || 'O servidor recusou a ação.';
}
