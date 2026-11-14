import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { rotasAuth } from './auth/rotas.ts';
import { rotasAvatar } from './avatar/rotas.ts';
import { rotasPreferencias } from './preferencias/rotas.ts';
import type { ContextoApp } from './contexto.ts';
import { rotasJogo } from './jogo/rotas.ts';
import { carregarSessao, exigirMesmaOrigem } from './middleware.ts';
import { rotasRanking } from './ranking/rotas.ts';

export function criarApp(ctx: ContextoApp) {
  const app = express();

  app.disable('x-powered-by');
  // O navegador fala com o Next, que repassa ao Express pela rede interna do
  // Docker: o IP real vem no X-Forwarded-For, confiável só de redes privadas.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    const bancoOk = await ctx.verificarBanco();
    res
      .status(bancoOk ? 200 : 503)
      .json({ status: bancoOk ? 'ok' : 'erro', db: bancoOk ? 'ok' : 'fora' });
  });

  app.use(exigirMesmaOrigem(ctx));
  app.use(carregarSessao(ctx));
  app.use('/auth', rotasAuth(ctx));
  app.use('/me/avatar', rotasAvatar(ctx));
  app.use('/me/preferencias', rotasPreferencias(ctx));
  app.use('/game', rotasJogo(ctx));
  app.use('/ranking', rotasRanking(ctx));

  app.use((_req, res) => {
    res.status(404).json({ erro: 'nao_encontrado' });
  });

  const tratarErro: ErrorRequestHandler = (err, _req, res, _next) => {
    // JSON malformado ou corpo grande demais chegam aqui com status 4xx.
    const status = typeof err?.status === 'number' && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ erro: status === 500 ? 'erro_interno' : 'requisicao_invalida' });
  };
  app.use(tratarErro);

  return app;
}
