// API de jogo (Portão 5). O servidor é a autoridade: liquida pelo próprio
// relógio, sorteia com o gerador guardado no estado e nunca devolve o segredo.
import { avisoDeComposicao, faseDesbloqueada, liquidar, prontidaoDaTropa, visaoDoCliente, type EstadoJogo } from '@cronarca/game-core';
import { Router, type Response } from 'express';
import { LimiteTentativas } from '../auth/limite.ts';
import { CONFIG_JOGO } from '../config.ts';
import type { ContextoApp } from '../contexto.ts';
import { exigirSessao } from '../middleware.ts';
import { esquemaApagar, esquemaConsultaProntidao, esquemaCorpoAcao, lerAcao } from './esquemas.ts';
import { apagarProgresso, executarAcao, obterOuCriarEstado } from './repositorio.ts';
import { registrarAtividade } from '../ranking/repositorio.ts';

/** Estado liquidado até agora, sem a parte secreta. */
function corpoEstado(estado: EstadoJogo, rev: number, agora: number, carimbo: number = agora) {
  const liquidado = liquidar(estado, Math.max(agora, estado.t));
  // O `agora` do corpo é o relógio do servidor no instante em que a resposta SAI (depois do banco), não o do início
  // da requisição: o cliente mede a hora de chegada contra ele e o relógio estimado não pode recuar a cada resposta.
  return { estado: visaoDoCliente(liquidado), rev, agora: Math.max(carimbo, liquidado.t) };
}

function usuarioId(res: Response): string {
  return res.locals.usuario!.id;
}

export function rotasJogo(ctx: ContextoApp) {
  const r = Router();
  const agoraMs = () => ctx.agora().getTime();
  const limiteAcoes = new LimiteTentativas(CONFIG_JOGO.limiteAcoesJanelaMs, CONFIG_JOGO.limiteAcoesPorJanela, agoraMs);

  r.use(exigirSessao);
  r.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  r.get('/state', async (_req, res) => {
    const agora = agoraMs();
    const { estado, rev } = await obterOuCriarEstado(ctx.prisma, usuarioId(res), agora, ctx.sortearSemente);
    await registrarAtividade(ctx.prisma, usuarioId(res), agora);
    res.json(corpoEstado(estado, rev, agora, agoraMs()));
  });

  /**
   * Prontidão da tropa para uma fase (Portão 20d-2), só leitura: o poder da tropa
   * (ids de aventureiros do próprio jogador), o mínimo e o recomendado da fase, o que
   * falta e o aviso de composição. Não grava estado e não conta como atividade.
   */
  r.get('/readiness', async (req, res) => {
    const consulta = esquemaConsultaProntidao.safeParse(req.query);
    if (!consulta.success) {
      res.status(400).json({ erro: 'dados_invalidos' });
      return;
    }
    const { fase, tropa: ids } = consulta.data;
    const agora = agoraMs();
    const { estado, rev } = await obterOuCriarEstado(ctx.prisma, usuarioId(res), agora, ctx.sortearSemente);
    const liquidado = liquidar(estado, Math.max(agora, estado.t));
    if (!faseDesbloqueada(liquidado, fase)) {
      res.status(403).json({ erro: 'fase_bloqueada' });
      return;
    }
    const guerreiros = ids.map((id) => liquidado.aventureiros.find((a) => a.id === id));
    if (guerreiros.some((g) => !g)) {
      res.status(404).json({ erro: 'aventureiro_inexistente' });
      return;
    }
    const tropa = guerreiros as NonNullable<(typeof guerreiros)[number]>[];
    res.json({ fase, tropa: ids, prontidao: prontidaoDaTropa(tropa, fase), composicao: avisoDeComposicao(tropa), rev, agora });
  });

  /** Conta a requisição no limite por usuário; false (e 429 já respondido) se passou. */
  function dentroDoLimite(userId: string, res: Response): boolean {
    const lim = limiteAcoes.consultar(userId);
    if (!lim.permitido) {
      res.setHeader('Retry-After', String(lim.esperarS));
      res.status(429).json({ erro: 'muitas_requisicoes', esperarS: lim.esperarS });
      return false;
    }
    limiteAcoes.registrar(userId);
    return true;
  }

  r.post('/actions', async (req, res) => {
    const userId = usuarioId(res);
    if (!dentroDoLimite(userId, res)) return;

    const corpo = esquemaCorpoAcao.safeParse(req.body);
    if (!corpo.success) {
      res.status(400).json({ erro: 'dados_invalidos' });
      return;
    }
    const acao = lerAcao(corpo.data);
    if (!acao) {
      res.status(400).json({ erro: 'acao_invalida' });
      return;
    }

    const agora = agoraMs();
    // Antes da ação: se ela for um marco, o ranking leva o tempo até agora.
    await registrarAtividade(ctx.prisma, userId, agora);
    const saida = await executarAcao(ctx.prisma, {
      userId,
      acao,
      idempotencyKey: corpo.data.idempotencyKey,
      revEsperada: corpo.data.revEsperada,
      agora,
      sortearSemente: ctx.sortearSemente,
    });
    const estado = corpoEstado(saida.estado, saida.rev, agora, agoraMs());

    if (saida.tipo === 'conflito') {
      res.status(409).json({ erro: 'rev_desatualizada', ...estado });
      return;
    }
    res.status(saida.resultado.ok ? 200 : 422).json({ ...saida.resultado, repetida: saida.tipo === 'repetida', ...estado });
  });

  // Zona de risco das Configurações: recomeça a conta do zero (sem volta).
  r.post('/reset', async (req, res) => {
    const userId = usuarioId(res);
    if (!dentroDoLimite(userId, res)) return;
    if (!esquemaApagar.safeParse(req.body).success) {
      res.status(400).json({ erro: 'confirmacao_invalida' });
      return;
    }
    const agora = agoraMs();
    const { estado, rev } = await apagarProgresso(ctx.prisma, userId, agora, ctx.sortearSemente);
    res.json(corpoEstado(estado, rev, agora, agoraMs()));
  });

  return r;
}
