// Preferências do jogador (Configurações). Não são estado de jogo: ficam na
// conta, fora do GameState, e não passam pelo rev nem pelo ActionLog.
import { esquemaPreferencias, lerPreferencias } from '@cronarca/game-core';
import { Router } from 'express';
import type { ContextoApp } from '../contexto.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { exigirSessao } from '../middleware.ts';

export function rotasPreferencias(ctx: ContextoApp) {
  const r = Router();
  r.use(exigirSessao);

  r.get('/', (_req, res) => {
    res.json({ preferencias: lerPreferencias(res.locals.usuario!.preferencias) });
  });

  r.put('/', async (req, res) => {
    const dados = esquemaPreferencias.safeParse(req.body);
    if (!dados.success) {
      res.status(400).json({ erro: 'dados_invalidos' });
      return;
    }
    await ctx.prisma.user.update({
      where: { id: res.locals.usuario!.id },
      data: { preferencias: dados.data as Prisma.InputJsonValue },
    });
    res.json({ preferencias: dados.data });
  });

  return r;
}
