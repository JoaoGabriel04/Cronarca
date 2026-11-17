/** Legenda do botão "Jogar sem conta" (decisão do dono, 17/11): vale para desktop e mobile. */
export const LEGENDA_CONVIDADO = 'Cria uma conta de convidado. Vincule um e-mail ou o Google depois para não perder o progresso.';

/** Aviso discreto no jogo para quem ainda é convidado. */
export const AVISO_CONVIDADO = 'Conta de convidado: vincule para guardar seu reino e entrar no ranking.';

/** O que o retorno do vínculo por Google ou Discord pede à tela (a query vem do callback do backend). */
export type RetornoVinculo = { passo: 'nome'; nome: string } | { passo: 'erro'; codigo: string };

export function lerRetornoVinculo(params: URLSearchParams): RetornoVinculo | null {
  const erro = params.get('vinculo_erro');
  if (erro) return { passo: 'erro', codigo: erro };
  if (params.get('vinculo') === 'nome') return { passo: 'nome', nome: (params.get('nome') ?? '').slice(0, 32) };
  return null;
}

/** Tira da URL os parâmetros do retorno do vínculo, sem recarregar. */
export function semParametrosDeVinculo(url: URL): string {
  for (const k of ['vinculo', 'vinculo_erro', 'nome']) url.searchParams.delete(k);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Nome pré-preenchido: o do provedor, senão a parte do e-mail antes do @, senão vazio (o jogador digita). */
export function nomeParaConfirmar(sugestao: string | null | undefined, email: string | null | undefined): string {
  const s = (sugestao ?? '').trim();
  if (s) return s.slice(0, 32);
  return (email ?? '').split('@')[0]?.slice(0, 32) ?? '';
}
