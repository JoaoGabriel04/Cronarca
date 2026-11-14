// GET /ranking (Portão 15): lido só do servidor. Pede login; nunca devolve
// e-mail, id nem o nome completo de outros jogadores.
import { ABAS_RANKING } from '@cronarca/game-core';
import { Router } from 'express';
import { z } from 'zod';
import type { ContextoApp } from '../contexto.ts';
import { exigirSessao } from '../middleware.ts';
import { listarRanking } from './repositorio.ts';

const esquemaConsulta = z.strictObject({ aba: z.enum(ABAS_RANKING).default('geral') });

export function rotasRanking(ctx: ContextoApp) {
  const r = Router();
  r.use(exigirSessao);

  r.get('/', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const consulta = esquemaConsulta.safeParse(req.query);
    if (!consulta.success) {
      res.status(400).json({ erro: 'dados_invalidos' });
      return;
    }
    res.json(await listarRanking(ctx.prisma, res.locals.usuario!.id, consulta.data.aba, ctx.agora().getTime()));
  });

  return r;
}
