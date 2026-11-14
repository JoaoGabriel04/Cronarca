import { Router } from 'express';
import { z } from 'zod';
import { usuarioPublico } from '../auth/usuario-publico.ts';
import type { ContextoApp } from '../contexto.ts';
import { exigirSessao } from '../middleware.ts';
import { assinaturaDeUpload, urlDeAvatarValida } from './cloudinary.ts';

const esquemaAvatar = z.strictObject({ url: z.string().max(512) });

export function rotasAvatar(ctx: ContextoApp) {
  const r = Router();
  r.use(exigirSessao);

  r.post('/assinatura', (_req, res) => {
    if (!ctx.cloudinary) {
      res.status(503).json({ erro: 'avatar_indisponivel' });
      return;
    }
    res.json(assinaturaDeUpload(ctx.cloudinary, res.locals.usuario!.id, ctx.agora()));
  });

  r.put('/', async (req, res) => {
    if (!ctx.cloudinary) {
      res.status(503).json({ erro: 'avatar_indisponivel' });
      return;
    }
    const dados = esquemaAvatar.safeParse(req.body);
    const usuario = res.locals.usuario!;
    if (!dados.success || !urlDeAvatarValida(ctx.cloudinary, usuario.id, dados.data.url)) {
      res.status(400).json({ erro: 'avatar_invalido' });
      return;
    }
    const atualizado = await ctx.prisma.user.update({
      where: { id: usuario.id },
      data: { avatarUrl: dados.data.url },
    });
    res.json({ usuario: await usuarioPublico(ctx.prisma, atualizado) });
  });

  return r;
}
