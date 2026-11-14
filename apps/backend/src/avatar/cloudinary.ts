// Upload assinado do Cloudinary: o backend assina os parâmetros, o navegador
// envia a imagem direto ao Cloudinary e depois informa a URL resultante,
// que o backend só aceita se for da nossa conta, da pasta e do id do usuário.
import { createHash } from 'node:crypto';
import { CONFIG_AVATAR } from '../config.ts';

export interface ConfigCloudinary {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

interface EnvCloudinary {
  CLOUDINARY_CLOUD_NAME?: string | undefined;
  CLOUDINARY_API_KEY?: string | undefined;
  CLOUDINARY_API_SECRET?: string | undefined;
}

export function cloudinaryDoEnv(env: EnvCloudinary): ConfigCloudinary | null {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: apiSecret } = env;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

/** Assinatura do Cloudinary: parâmetros em ordem alfabética, "k=v" unidos por "&", mais o segredo, em SHA-1. */
export function assinarParametros(params: Record<string, string>, apiSecret: string): string {
  const texto = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(texto + apiSecret).digest('hex');
}

export function assinaturaDeUpload(cfg: ConfigCloudinary, userId: string, agora: Date) {
  const params = {
    allowed_formats: CONFIG_AVATAR.formatos.join(','),
    folder: CONFIG_AVATAR.pasta,
    overwrite: 'true',
    public_id: userId,
    timestamp: String(Math.floor(agora.getTime() / 1000)),
  };
  return {
    urlUpload: `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,
    apiKey: cfg.apiKey,
    params,
    assinatura: assinarParametros(params, cfg.apiSecret),
  };
}

function escaparRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A URL só vale se for https, da nossa conta, da pasta de avatares e do próprio usuário. */
export function urlDeAvatarValida(cfg: ConfigCloudinary, userId: string, url: string): boolean {
  const formatos = CONFIG_AVATAR.formatos.join('|');
  const padrao = new RegExp(
    `^https://res\\.cloudinary\\.com/${escaparRegex(cfg.cloudName)}/image/upload/` +
      `(?:v\\d+/)?${escaparRegex(CONFIG_AVATAR.pasta)}/${escaparRegex(userId)}\\.(?:${formatos})$`,
  );
  return padrao.test(url);
}
