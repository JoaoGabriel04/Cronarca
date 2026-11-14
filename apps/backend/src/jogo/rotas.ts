// API de jogo (Portão 5). O servidor é a autoridade: liquida pelo próprio
// relógio, sorteia com o gerador guardado no estado e nunca devolve o segredo.
import { liquidar, visaoDoCliente, type EstadoJogo } from '@cronarca/game-core';
import { Router, type Response } from 'express';
import { LimiteTentativas } from '../auth/limite.ts';
import { CONFIG_JOGO } from '../config.ts';
import type { ContextoApp } from '../contexto.ts';
import { exigirSessao } from '../middleware.ts';
import { esquemaApagar, esquemaCorpoAcao, lerAcao } from './esquemas.ts';
import { apagarProgresso, executarAcao, obterOuCriarEstado } from './repositorio.ts';
import { registrarAtividade } from '../ranking/repositorio.ts';

/** Estado liquidado até agora, sem a parte secreta. */
function corpoEstado(estado: EstadoJogo, rev: number, agora: number) {
  const liquidado = liquidar(estado, Math.max(agora, estado.t));
  return { estado: visaoDoCliente(liquidado), rev, agora };
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
    res.json(corpoEstado(estado, rev, agora));
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
    const estado = corpoEstado(saida.estado, saida.rev, agora);

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
    res.json(corpoEstado(estado, rev, agora));
  });

  return r;
}
