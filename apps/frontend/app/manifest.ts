import type { MetadataRoute } from 'next';
import { CORES_MARCA, MARCA } from '../lib/marca';

// Manifest do app (instalar na tela inicial): nome e o selo do relógio.
// O 192 é opaco (fundo da arte); o 512 tem fundo transparente.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARCA.nome,
    short_name: MARCA.nome,
    description: MARCA.descricao,
    lang: 'pt-BR',
    start_url: '/',
    display: 'standalone',
    background_color: CORES_MARCA.fundo,
    theme_color: CORES_MARCA.fundo,
    icons: MARCA.iconesManifest.map((i) => ({ src: i.src, sizes: `${i.lado}x${i.lado}`, type: 'image/png', purpose: 'any' })),
  };
}
