// Parâmetros de segurança da autenticação. Não são números de economia do
// jogo (esses ficam em packages/game-core/data), mas também não ficam
// espalhados pelo código: mudam aqui.

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

export const CONFIG_AUTH = {
  /** Validade da sessão, renovada com o uso. */
  sessaoDuracaoMs: 30 * DIA,
  /** A validade só é renovada (escrita no banco) se a última renovação tiver mais que isto. */
  sessaoRenovarAposMs: 1 * DIA,
  cookieSessao: 'cronarca_sessao',
  cookieOAuth: 'cronarca_oauth',
  /** Tempo para o jogador concluir o login no Google/Discord. */
  oauthValidadeMs: 10 * MINUTO,
  /** Limite de tentativas de login/cadastro, por IP e por e-mail. */
  limiteJanelaMs: 15 * MINUTO,
  limiteTentativas: 10,
  bcryptCusto: 12,
  nomeMin: 2,
  nomeMax: 32,
  senhaMin: 8,
  /** O bcrypt ignora o que passa de 72 bytes. */
  senhaMaxBytes: 72,
} as const;

// Proteção da API de jogo. O limite de cliques do jogo é outro e fica nos
// dados do game-core (FORMULAS.clique); este só segura excesso de requisições.
export const CONFIG_JOGO = {
  /** Requisições de ação por usuário, em janela fixa. */
  limiteAcoesJanelaMs: 1000,
  limiteAcoesPorJanela: 20,
} as const;

export const CONFIG_AVATAR = {
  pasta: 'cronarca/avatares',
  formatos: ['png', 'jpg', 'jpeg', 'webp'],
} as const;
