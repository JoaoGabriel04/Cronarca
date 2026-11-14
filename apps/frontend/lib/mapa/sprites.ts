// Sprites do mapa: PNG 1x exportados do Figma (página Sprites). Um nome solto
// é /mapa/<nome>.png; um endereço (começa com /) é o próprio arquivo, como os
// quadros animados em /sprites/<grupo>/<nome>_<k>.png (quadros.json).

export type Sprites = ReadonlyMap<string, HTMLImageElement>;

function carregar(nome: string): Promise<[string, HTMLImageElement]> {
  return new Promise((resolver, rejeitar) => {
    const img = new Image();
    img.onload = () => resolver([nome, img]);
    img.onerror = () => rejeitar(new Error(`sprite não encontrado: ${nome}`));
    img.src = nome.startsWith('/') ? nome : `/mapa/${nome}.png`;
  });
}

export async function carregarSprites(nomes: readonly string[]): Promise<Sprites> {
  return new Map(await Promise.all(nomes.map(carregar)));
}
