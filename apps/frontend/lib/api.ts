// Cliente da API. O navegador só fala com o Next (/api/...), que repassa ao
// Express. Os cookies de sessão viajam sozinhos (mesma origem).

export interface UsuarioPublico {
  id: string;
  nome: string;
  /** Nulo em conta de convidado. */
  email: string | null;
  avatarUrl: string | null;
  emailVerificado: boolean;
  temSenha: boolean;
  /** Conta de convidado: sem e-mail e fora do ranking até vincular. */
  convidado: boolean;
  /** Já ligou Google ou Discord e falta confirmar o nome. */
  vinculoPendente: boolean;
  provedores: ('google' | 'discord')[];
}

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    readonly campos: Record<string, string> = {},
    readonly esperarS?: number,
  ) {
    super(codigo);
  }
}

async function lerErro(res: Response): Promise<ErroApi> {
  const corpo = (await res.json().catch(() => ({}))) as {
    erro?: string;
    campos?: Record<string, string>;
    esperarS?: number;
  };
  return new ErroApi(res.status, corpo.erro ?? 'erro_desconhecido', corpo.campos, corpo.esperarS);
}

/** Fetcher do SWR para GET. */
export async function buscar<T>(caminho: string): Promise<T> {
  const res = await fetch(caminho, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw await lerErro(res);
  return (await res.json()) as T;
}

/** POST com corpo JSON. O cliente manda só o que o usuário digitou; o servidor decide. */
export async function enviar<T>(caminho: string, corpo?: unknown): Promise<T | null> {
  const res = await fetch(caminho, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!res.ok) throw await lerErro(res);
  return res.status === 204 ? null : ((await res.json()) as T);
}

/** PUT com corpo JSON (preferências): substitui o recurso inteiro. */
export async function atualizar<T>(caminho: string, corpo: unknown): Promise<T> {
  const res = await fetch(caminho, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!res.ok) throw await lerErro(res);
  return (await res.json()) as T;
}

const MENSAGENS: Record<string, string> = {
  credenciais_invalidas: 'E-mail ou senha incorretos.',
  email_em_uso: 'Este e-mail já tem conta. Entre com ele.',
  muitas_tentativas: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  dados_invalidos: 'Confira os campos destacados.',
  origem_invalida: 'Requisição recusada. Recarregue a página.',
  provedor_indisponivel: 'Esse login ainda não está disponível.',
  login_cancelado: 'Login cancelado.',
  oauth_invalido: 'O login expirou ou foi interrompido. Tente de novo.',
  oauth_falhou: 'Não foi possível falar com o provedor. Tente de novo.',
  email_nao_verificado: 'Seu e-mail não está verificado nesse provedor.',
  conta_ja_vinculada: 'Este e-mail ou esta conta já pertence a outro reino.',
  convidados_esgotados: 'Muitos convidados entrando agora. Tente de novo em alguns minutos.',
  nao_e_convidado: 'Esta conta já está vinculada.',
  vinculo_inexistente: 'Ligue o Google ou o Discord antes de confirmar o nome.',
};

export function mensagemDeErro(codigo: string): string {
  return MENSAGENS[codigo] ?? 'Algo deu errado. Tente de novo.';
}
