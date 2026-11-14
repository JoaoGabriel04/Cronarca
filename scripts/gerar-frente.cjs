// Camada de frente das árvores (versão 2 do mapa): as pedras, arbustos e flores
// que na arte original (docs/referencia/mapa_base_v1.png, o mapa com as árvores
// pintadas) ficavam NA FRENTE de uma árvore. Como as árvores agora são
// desenhadas por cima do mapa_base.png novo, elas cobririam essas peças.
//
// Compõe "mapa_base.png novo + árvores no quadro de repouso (k = 2), na ordem
// do meta" e compara com a arte original. Onde der diferente, o pixel original
// vai para public/mapa/mapa_frente.png (transparente no resto), que o mapa
// desenha logo depois das árvores. Parado, o resultado é idêntico à arte.
//
// Também entram os pixels semitransparentes que ficam por cima (a base de cada
// árvore, linhas 44 a 46 do sprite, alfa 70): eles não se mexem no balanço, e o
// canvas do navegador arredonda a mistura com 1 de diferença da arte.
//
// Uso: `make gerar-frente` (roda na imagem do Playwright, com pngjs). Só precisa
// rodar de novo se o mapa, o meta ou os sprites das árvores mudarem.
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const RAIZ = path.resolve(__dirname, '..');
const PUB = path.join(RAIZ, 'apps/frontend/public/mapa');
const ORIGINAL = path.join(RAIZ, 'docs/referencia/mapa_base_v1.png');
const SAIDA = path.join(PUB, 'mapa_frente.png');
/** Quadro de repouso do balanço: o desenho pintado na arte original. */
const REPOUSO = 2;

const ler = (f) => PNG.sync.read(fs.readFileSync(f));
const meta = JSON.parse(fs.readFileSync(path.join(RAIZ, 'packages/game-core/data/mapa_meta.json'), 'utf8'));
const base = ler(path.join(PUB, 'mapa_base.png'));
const original = ler(ORIGINAL);
const { width: W, height: H } = base;
if (original.width !== W || original.height !== H) throw new Error('mapa_base_v1.png com tamanho diferente do mapa_base.png');

// Composição em memória: alfa sobre fundo opaco, arredondado (a mesma conta do teste).
const comp = Buffer.from(base.data);
/** O último que pintou o pixel foi um pixel semitransparente de árvore. */
const semi = new Uint8Array(W * H);
const sprites = new Map();
for (const a of meta.arvores) {
  const nome = `${a.variante}_${a.quadro}_${REPOUSO}`;
  if (!sprites.has(nome)) sprites.set(nome, ler(path.join(PUB, 'arvores', `${nome}.png`)));
  const s = sprites.get(nome);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const si = (y * s.width + x) * 4;
      const al = s.data[si + 3];
      const X = a.ox + x;
      const Y = a.oy + y;
      if (!al || X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const di = (Y * W + X) * 4;
      for (let c = 0; c < 3; c++) comp[di + c] = Math.round((s.data[si + c] * al + comp[di + c] * (255 - al)) / 255);
      semi[Y * W + X] = al < 255 ? 1 : 0;
    }
  }
}

const frente = new PNG({ width: W, height: H });
frente.data.fill(0);
let n = 0;
let nSemi = 0;
for (let p = 0; p < W * H; p++) {
  const i = p * 4;
  const igual = comp[i] === original.data[i] && comp[i + 1] === original.data[i + 1] && comp[i + 2] === original.data[i + 2];
  if (igual && !semi[p]) continue;
  original.data.copy(frente.data, i, i, i + 3);
  frente.data[i + 3] = 255;
  if (igual) nSemi++;
  else n++;
}
fs.writeFileSync(SAIDA, PNG.sync.write(frente));
console.log(`mapa_frente.png: ${n} pixels na frente das árvores + ${nSemi} da base semitransparente delas (${fs.statSync(SAIDA).size} bytes)`);
