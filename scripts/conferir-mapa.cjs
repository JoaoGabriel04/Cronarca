// Conferência do mapa grande no Chromium (Portão 7c, testes 4 e 5 da seção 7
// do CRONARCA_MAPA_GRANDE.md). Roda dentro da imagem do Playwright (ver
// `make conferir-mapa`), com o app de pé e a conta de desenvolvimento.
//
// 4. Pixel: em 1x a 4x, nos dois cantos da imagem, cada pixel do canvas é
//    igual ao pixel da arte que cai nele (vizinho mais próximo, sem
//    suavização), com devicePixelRatio 1 e 2. Versão 2 do mapa: o canvas
//    desenha o mapa sem árvores + as árvores (L4) + a camada de frente; com a
//    animação parada (prefers-reduced-motion) as árvores ficam no repouso e o
//    resultado tem de ser a arte original (docs/referencia/mapa_base_v1.png).
// 4b. Vento: com a animação ligada, o canvas só difere da arte dentro dos
//    sprites das árvores (a copa balança), e difere em algum lugar.
// 5. Desempenho: arrasta o mapa em 2x por ~4 s e mede os quadros por segundo,
//    e conta as árvores desenhadas por quadro em 1x a 4x.
// Também grava capturas do preview em 1x, 2x e 3x em docs/referencia.
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('node:fs');
const path = require('node:path');

const APP = process.env.APP_URL || 'http://localhost:3000';
const RAIZ = path.resolve(__dirname, '..');
/** Gabarito: a arte original, com as árvores pintadas (a composição parada tem de dar ela). */
const ARQUIVO = path.join(RAIZ, 'docs/referencia/mapa_base_v1.png');
const META = JSON.parse(fs.readFileSync(path.join(RAIZ, 'packages/game-core/data/mapa_meta.json'), 'utf8'));
/** Pins da L7 ficam por cima da imagem de propósito: a conferência pula uma caixa em volta de cada destino (px de tela). */
const FOLGA_PIN = { esquerda: 120, direita: 120, cima: 90, baixo: 40 };
/** Fundo do canvas (CORES.fora no CanvasMapa): pixel semitransparente da imagem é composto sobre ele. */
const FUNDO = [0x0d, 0x15, 0x12];
const SAIDA = path.join(RAIZ, 'docs/referencia');

async function abrir(navegador, dpr, vento = false) {
  // Sem vento: movimento reduzido, as árvores ficam no quadro de repouso (o desenho da arte).
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr, reducedMotion: vento ? 'no-preference' : 'reduce' });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(String(e)));
  const login = await pagina.request.post(`${APP}/api/auth/login`, { headers: { Origin: APP }, data: { email: 'dev@cronarca.local', senha: 'cronarca' } });
  if (!login.ok()) throw new Error(`login falhou (${login.status()}): rode \`make seed\``);
  // Pesquisas concluídas: sem a névoa da Cripta, que fica por cima da arte de propósito.
  await pagina.goto(`${APP}/jogo/mapa?pesquisas=cartografia,estradas_reais`);
  await pagina.waitForSelector('[data-pronto="sim"]', { timeout: 60_000 });
  await pagina.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((e) => e.remove()));
  return { contexto, pagina, erros };
}

const quadros = (pagina, n = 3) => pagina.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function zoom(pagina, z) {
  await pagina.click(`[data-zoom="${z}"]`);
  await pagina.waitForSelector(`[data-pronto="sim"][data-zoom="${z}"]`);
  await quadros(pagina);
}

/** Arrasta até a câmera encostar no canto (o pan prende na imagem). */
async function irAoCanto(pagina, canto) {
  const caixa = await pagina.locator('canvas').boundingBox();
  const cx = caixa.x + caixa.width / 2;
  const cy = caixa.y + caixa.height / 2;
  const s = canto === 'no' ? 1 : -1;
  // Até a câmera parar de mexer (encostou no limite da imagem).
  for (let k = 0, antes = ''; k < 60; k++) {
    const agora = await pagina.evaluate(() => { const m = document.querySelector('[data-pronto]'); return `${m.dataset.camX};${m.dataset.camY}`; });
    if (agora === antes) break;
    antes = agora;
    await pagina.mouse.move(cx, cy);
    await pagina.mouse.down();
    await pagina.mouse.move(cx + s * 600, cy + s * 400, { steps: 4 });
    await pagina.mouse.up();
  }
  await pagina.mouse.move(caixa.x + caixa.width + 50, caixa.y - 50 < 0 ? 5 : caixa.y - 50); // tira o hover do mapa
  await quadros(pagina);
}

/** Retângulos dos sprites das árvores, em mundo. */
const ARVORES = META.arvores.map((a) => ({ x: a.ox, y: a.oy }));
const naArvore = (ix, iy) => ARVORES.some((a) => ix >= a.x && ix < a.x + 48 && iy >= a.y && iy < a.y + 48);

async function compararPixels(pagina, base, { foraDasArvores = false } = {}) {
  // O canvas sai como PNG (sem perda): copiar os pixels como array estoura a memória com dpr 2.
  const r = await pagina.evaluate(() => {
    const m = document.querySelector('[data-pronto]');
    const c = m.querySelector('canvas');
    return {
      cam: { x: Number(m.dataset.camX), y: Number(m.dataset.camY), zoom: Number(m.dataset.zoom) },
      escala: Number(m.dataset.escala),
      css: { largura: c.clientWidth, altura: c.clientHeight },
      png: c.toDataURL('image/png').split(',')[1],
    };
  });
  const tela = PNG.sync.read(Buffer.from(r.png, 'base64'));
  const { cam, escala, css } = r;
  const dx = Math.round(css.largura / 2 - cam.x * cam.zoom);
  const dy = Math.round(css.altura / 2 - cam.y * cam.zoom);
  const pins = Object.values(META.destinos).map((d) => ({ x: d.x * cam.zoom + dx, y: d.y * cam.zoom + dy }));
  const sobPin = (x, y) => pins.some((p) => x >= p.x - FOLGA_PIN.esquerda && x <= p.x + FOLGA_PIN.direita && y >= p.y - FOLGA_PIN.cima && y <= p.y + FOLGA_PIN.baixo);
  let diferentes = 0;
  let total = 0;
  let pulados = 0;
  let fora = 0;
  let dentroArvore = 0;
  const exemplos = [];
  for (let y = 0; y < tela.height; y++) {
    for (let x = 0; x < tela.width; x++) {
      const ix = Math.floor((x / escala - dx) / cam.zoom);
      const iy = Math.floor((y / escala - dy) / cam.zoom);
      if (ix < 0 || iy < 0 || ix >= base.width || iy >= base.height) { fora++; continue; }
      if (sobPin(x / escala, y / escala)) { pulados++; continue; }
      const a = (y * tela.width + x) * 4;
      const b = (iy * base.width + ix) * 4;
      total++;
      // Cor esperada: a do PNG sobre o fundo (igual ao PNG quando o pixel é opaco). ±2 de arredondamento da composição (o canvas guarda a cor pré-multiplicada).
      const al = base.data[b + 3] / 255;
      const esperado = [0, 1, 2].map((c) => base.data[b + c] * al + FUNDO[c] * (1 - al));
      if ([0, 1, 2].some((c) => Math.abs(tela.data[a + c] - esperado[c]) > (al === 1 ? 0 : 2))) {
        // Com vento, a diferença dentro de um sprite de árvore é o balanço (conta à parte).
        if (foraDasArvores && naArvore(ix, iy)) { dentroArvore++; continue; }
        diferentes++;
        if (exemplos.length < 3) exemplos.push({ tela: [x, y], imagem: [ix, iy], canvas: Array.from(tela.data.slice(a, a + 3)), png: Array.from(base.data.slice(b, b + 4)) });
      }
    }
  }
  return { cam, escala, total, pulados, diferentes, dentroArvore, exemplos, cobre: fora === 0 };
}

async function medirFps(pagina) {
  await zoom(pagina, 2);
  const caixa = await pagina.locator('canvas').boundingBox();
  const cx = caixa.x + caixa.width / 2;
  const cy = caixa.y + caixa.height / 2;
  await pagina.evaluate(() => {
    window.__quadros = [];
    const f = (t) => { window.__quadros.push(t); if (window.__quadros.length < 100000) window.__medindo = requestAnimationFrame(f); };
    window.__medindo = requestAnimationFrame(f);
  });
  const inicio = Date.now();
  let sentido = 1;
  while (Date.now() - inicio < 4000) {
    await pagina.mouse.move(cx, cy);
    await pagina.mouse.down();
    for (let k = 1; k <= 30; k++) await pagina.mouse.move(cx + sentido * k * 12, cy + sentido * k * 6);
    await pagina.mouse.up();
    sentido = -sentido;
  }
  const t = await pagina.evaluate(() => { cancelAnimationFrame(window.__medindo); return window.__quadros; });
  const intervalos = t.slice(1).map((v, i) => v - t[i]).sort((a, b) => a - b);
  const segundos = (t[t.length - 1] - t[0]) / 1000;
  return {
    fps: Math.round((t.length - 1) / segundos),
    mediana: intervalos[Math.floor(intervalos.length / 2)].toFixed(1),
    p95: intervalos[Math.floor(intervalos.length * 0.95)].toFixed(1),
    acima33: intervalos.filter((v) => v > 33.4).length,
    quadros: t.length,
  };
}

(async () => {
  if (!fs.existsSync(ARQUIVO)) throw new Error(`falta ${path.relative(RAIZ, ARQUIVO)}`);
  const base = PNG.sync.read(fs.readFileSync(ARQUIVO));
  let translucidos = 0;
  for (let i = 3; i < base.data.length; i += 4) if (base.data[i] !== 255) translucidos++;
  console.log(`gabarito ${path.relative(RAIZ, ARQUIVO)}: ${base.width} x ${base.height}`);
  if (translucidos) console.log(`AVISO: ${translucidos} pixels semitransparentes na imagem (aparecem mais escuros, compostos sobre o fundo ${'#' + FUNDO.map((c) => c.toString(16).padStart(2, '0')).join('')})`);
  const navegador = await chromium.launch();
  let falhou = false;
  const erros = [];

  for (const dpr of [1, 2]) {
    const { contexto, pagina, erros: e } = await abrir(navegador, dpr);
    for (const z of [1, 2, 3, 4]) {
      await zoom(pagina, z);
      for (const canto of ['no', 'se']) {
        await irAoCanto(pagina, canto);
        const r = await compararPixels(pagina, base);
        const ok = r.diferentes === 0 && r.cobre;
        if (!ok) falhou = true;
        console.log(`pixel  dpr ${dpr}  ${z}x  canto ${canto}  câmera (${r.cam.x}; ${r.cam.y})  ${r.total} px comparados (${r.pulados} sob pin), ${r.diferentes} diferentes${r.cobre ? '' : ', NÃO COBRE O CANVAS'}  ${ok ? 'ok' : 'FALHOU ' + JSON.stringify(r.exemplos)}`);
      }
    }
    if (dpr === 1) {
      // Capturas para a aprovação visual: o Reino (núcleo) em 1x, 2x e 3x, com a grade do meta em 1x.
      await pagina.goto(`${APP}/jogo/mapa`);
      await pagina.waitForSelector('[data-pronto="sim"]');
      await pagina.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((x) => x.remove()));
      for (const z of [1, 2, 3]) {
        await zoom(pagina, z);
        await pagina.screenshot({ path: path.join(SAIDA, `mapa_preview_${z}x.png`) });
      }
      await zoom(pagina, 1);
      await pagina.click('[data-grade]');
      await quadros(pagina);
      await pagina.screenshot({ path: path.join(SAIDA, 'mapa_preview_1x_grade.png') });
    }
    erros.push(...e);
    await contexto.close();
  }

  // 4b e 5: com vento.
  {
    const { contexto, pagina, erros: e } = await abrir(navegador, 1, true);
    for (const z of [1, 2]) {
      await zoom(pagina, z);
      await irAoCanto(pagina, 'no');
      const r = await compararPixels(pagina, base, { foraDasArvores: true });
      await pagina.waitForTimeout(350);
      const r2 = await compararPixels(pagina, base, { foraDasArvores: true });
      const ok = r.diferentes === 0 && r2.diferentes === 0 && r.dentroArvore + r2.dentroArvore > 0;
      if (!ok) falhou = true;
      console.log(`vento  dpr 1  ${z}x  fora das árvores: ${r.diferentes + r2.diferentes} px diferentes; dentro delas (balanço): ${r.dentroArvore} e ${r2.dentroArvore} px  ${ok ? 'ok' : 'FALHOU ' + JSON.stringify(r.exemplos)}`);
    }
    for (const z of [1, 2, 3, 4]) {
      await zoom(pagina, z);
      const n = await pagina.evaluate(() => document.querySelector('[data-pronto] canvas').dataset.arvores);
      console.log(`árvores desenhadas por quadro em ${z}x (canto noroeste): ${n} de ${META.arvores.length}`);
    }
    await pagina.goto(`${APP}/jogo/mapa`);
    await pagina.waitForSelector('[data-pronto="sim"]');
    await pagina.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((x) => x.remove()));
    const f = await medirFps(pagina);
    console.log(`fps    arraste em 2x por 4 s com vento (1440 x 900, dpr 1): ${f.fps} fps, quadro mediano ${f.mediana} ms, p95 ${f.p95} ms, ${f.acima33} quadros acima de 33 ms em ${f.quadros}`);
    erros.push(...e);
    await contexto.close();
  }
  await navegador.close();
  if (erros.length) throw new Error(`erros na página: ${erros.join('; ')}`);
  if (falhou) throw new Error('pixels diferentes da arte: ver acima');
  console.log(`capturas em ${path.relative(RAIZ, SAIDA)}/mapa_preview_*.png`);
})().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
