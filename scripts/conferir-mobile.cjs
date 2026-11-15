// Conferência do layout do celular no Chromium (Portão 14). Roda dentro da
// imagem do Playwright (ver `make conferir-mobile`), com o app de pé e a
// conta de desenvolvimento (`make seed`).
//
// Em 360, 390, 600 e 601 px de largura (844 de altura), em cada tela e modal:
// - layout do celular até 600 px e o empilhado em 601;
// - sem rolagem horizontal da página;
// - até 600 px, nenhum botão visível menor que 44 x 44 px;
// - touch-action: none só na janela do mapa (o canvas);
// - até 600 px, pinça com dois dedos no mapa do Reino: abrir aproxima, fechar afasta;
// - arrastar sobre o texto do jogo não seleciona nada (campos de texto, sim).
// Em 390 grava as capturas ao lado dos frames do Figma (docs/referencia/figma_mobile).
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('node:fs');
const path = require('node:path');

const APP = process.env.APP_URL || 'http://localhost:3000';
const RAIZ = path.resolve(__dirname, '..');
const FIGMA = path.join(RAIZ, 'docs/referencia/figma_mobile');
const SAIDA = path.join(RAIZ, 'docs/referencia');
const LARGURAS = [360, 390, 600, 601];
const ALTURA = 844;

const espera = (p, ms = 350) => p.waitForTimeout(ms);
const aba = (p, nome) => p.locator('nav[aria-label="Telas do jogo"] button', { hasText: nome }).click();
/** Alternância Vila/Reino sobre o mapa (não a aba Vila do rodapé). */
const visao = (p, nome) => p.locator('[data-layout] button', { hasText: new RegExp(`^${nome}$`) }).first().click();
const abrirConstrucoes = (p) => p.locator('[data-layout] button, header button').filter({ hasText: /^Construções$|^Construir$/ }).first().click();

/** Telas e modais, cada um com o jeito de chegar lá e o frame do Figma para comparar. */
const TELAS = [
  { nome: 'reino', figma: 'reino', ir: async (p) => { await aba(p, 'Vila'); await visao(p, 'Reino'); } },
  { nome: 'reino_gaveta_aberta', figma: 'reino_gaveta_aberta', soCelular: true, ir: async (p) => { await aba(p, 'Vila'); await visao(p, 'Reino'); await espera(p); await p.getByRole('button', { name: 'Abrir a lista de destinos' }).click(); } },
  { nome: 'vila', figma: 'vila', ir: async (p) => { await aba(p, 'Vila'); await visao(p, 'Vila'); } },
  { nome: 'herois', ir: (p) => aba(p, 'Heróis') },
  { nome: 'expedicoes', figma: 'expedicoes', ir: (p) => aba(p, 'Expedições') },
  { nome: 'eras', ir: (p) => aba(p, 'Eras') },
  { nome: 'catalogo', ir: async (p) => { await aba(p, 'Vila'); await visao(p, 'Vila'); await abrirConstrucoes(p); } },
  // O Melhorar do catálogo age direto; o modal Melhorar abre tocando na construção no mapa (a Casa).
  { nome: 'modal_melhorar', figma: 'modal_melhorar', ir: async (p) => { await aba(p, 'Vila'); await visao(p, 'Vila'); await espera(p, 800); await tocarNaCasa(p); await p.locator('[role="dialog"]').first().waitFor(); } },
  { nome: 'modal_configuracoes', ir: (p) => p.getByRole('button', { name: 'Configurações' }).click() },
  { nome: 'modal_ranking', figma: 'modal_ranking', ir: async (p) => { if (p.viewportSize().width <= 600) { await p.getByRole('button', { name: 'Configurações' }).click(); await espera(p); await p.getByRole('button', { name: 'Ver ranking' }).click(); } else { await p.getByRole('button', { name: 'Ranking' }).click(); } await p.locator('[role="dialog"] [role="table"] [role="row"]').nth(1).waitFor(); } },
];

/** Centro da hitbox da Casa (slot casa_1 + origem do núcleo + meio da hitbox), em mundo. */
const CASA_NO_MUNDO = { x: 147 + 1312 + 24, y: 186 + 928 + 23 };

/** Toca na Casa no mapa: converte mundo -> tela pela câmera que a moldura expõe (data-cam-x/y, data-zoom). */
async function tocarNaCasa(p) {
  const alvo = await p.evaluate((casa) => {
    const m = document.querySelector('[data-zoom]');
    const c = m.querySelector('canvas').getBoundingClientRect();
    const z = Number(m.dataset.zoom);
    return { x: c.left + (casa.x - Number(m.dataset.camX)) * z + c.width / 2, y: c.top + (casa.y - Number(m.dataset.camY)) * z + c.height / 2 };
  }, CASA_NO_MUNDO);
  await p.touchscreen.tap(alvo.x, alvo.y);
}

async function medir(p, largura) {
  return p.evaluate((largura) => {
    const doc = document.documentElement;
    const horizontal = Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth;
    const visivel = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
    };
    // Com um diálogo aberto, só o que está nele conta (o resto fica atrás do fundo escurecido).
    const dialogo = document.querySelector('[role="dialog"]');
    const raiz = dialogo || document;
    const pequenos = [...raiz.querySelectorAll('button, a[href], [role="button"]')]
      .filter(visivel)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => largura <= 600 && (r.width < 43.5 || r.height < 43.5))
      .map(({ el, r }) => `${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    const comTouchNone = [...document.querySelectorAll('*')]
      .filter((el) => getComputedStyle(el).touchAction === 'none')
      .map((el) => el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''));
    const layout = document.querySelector('[data-layout]')?.getAttribute('data-layout');
    // Conteúdo cortado à direita ou à esquerda: elemento visível da área (ou do modal) que passa da tela,
    // mesmo quando um pai com overflow esconde o excesso (a rolagem da página não acusa esse caso).
    const escopo = dialogo || document.querySelector('[data-layout]');
    const cortados = escopo
      ? [...escopo.querySelectorAll('*')]
          .filter((el) => !el.closest('canvas') && el.tagName !== 'CANVAS')
          .filter((el) => {
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden') return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
          })
          .filter((el, _, todos) => !todos.some((o) => o !== el && o.contains(el)))
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').pop().slice(0, 28)} ${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)}`)
      : [];
    return { horizontal, pequenos, comTouchNone, layout, cortados };
  }, largura);
}

/** App à esquerda, frame do Figma à direita (quando há frame). */
function ladoALado(app, figma) {
  const a = PNG.sync.read(app);
  const f = figma ? PNG.sync.read(fs.readFileSync(figma)) : null;
  const folga = 24;
  const largura = a.width + (f ? folga + f.width : 0);
  const altura = Math.max(a.height, f ? f.height : 0);
  const o = new PNG({ width: largura, height: altura });
  o.data.fill(255);
  const copiar = (img, ox) => {
    for (let y = 0; y < img.height; y++) img.data.copy(o.data, (y * largura + ox) * 4, y * img.width * 4, (y + 1) * img.width * 4);
  };
  copiar(a, 0);
  if (f) copiar(f, a.width + folga);
  return PNG.sync.write(o);
}

/** Zoom atual da câmera do mapa (data-zoom da moldura do canvas). */
const zoomDoMapa = (p) => p.locator('[data-zoom]').first().getAttribute('data-zoom').then(Number);

/** Dois dedos no centro do mapa: abrem de 60 para 130 px e soltam; depois fecham de 130 para 50 px. */
async function pinca(p) {
  const caixa = await p.locator('canvas[aria-label="Mapa do reino"]').boundingBox();
  const cx = caixa.x + caixa.width / 2;
  const cy = caixa.y + caixa.height / 2;
  const cdp = await p.context().newCDPSession(p);
  const toque = (tipo, d) =>
    cdp.send('Input.dispatchTouchEvent', {
      type: tipo,
      touchPoints: tipo === 'touchEnd' ? [] : [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }],
    });
  const gesto = async (de, ate) => {
    await toque('touchStart', de);
    for (let k = 1; k <= 8; k++) {
      await toque('touchMove', de + ((ate - de) * k) / 8);
      await p.waitForTimeout(16);
    }
    await toque('touchEnd', ate);
    await p.waitForTimeout(250);
  };
  const antes = await zoomDoMapa(p);
  await gesto(60, 130);
  const depoisDeAbrir = await zoomDoMapa(p);
  await gesto(130, 50);
  const depoisDeFechar = await zoomDoMapa(p);
  await cdp.detach();
  return { antes, depoisDeAbrir, depoisDeFechar };
}

(async () => {
  const navegador = await chromium.launch();
  // Um login só, reaproveitado nas quatro larguras (o backend limita as tentativas de login).
  const sessao = await navegador.newContext();
  const login = await sessao.request.post(`${APP}/api/auth/login`, { headers: { Origin: APP }, data: { email: 'dev@cronarca.local', senha: 'cronarca' } });
  if (!login.ok()) throw new Error(`login falhou (${login.status()}): rode \`make seed\`${login.status() === 429 ? ' ou espere o limite de tentativas' : ''}`);
  const storageState = await sessao.storageState();
  await sessao.close();
  let falhas = 0;
  for (const largura of LARGURAS) {
    const contexto = await navegador.newContext({ viewport: { width: largura, height: ALTURA }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, storageState });
    const p = await contexto.newPage();
    const erros = [];
    p.on('pageerror', (e) => erros.push(String(e)));
    await p.goto(`${APP}/jogo`, { timeout: 120_000 });
    await p.waitForSelector('[data-pronto="sim"]', { timeout: 120_000 });
    // O indicador do modo de desenvolvimento do Next.js não entra nas capturas.
    await p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    for (const t of TELAS) {
      if (t.soCelular && largura > 600) continue;
      await p.keyboard.press('Escape');
      await espera(p, 150);
      await t.ir(p);
      await espera(p);
      const m = await medir(p, largura);
      const esperado = largura <= 600 ? 'celular' : 'normal';
      const touchOk = m.comTouchNone.every((x) => x === 'canvas[Mapa do reino]');
      const ok = m.horizontal <= 0 && m.layout === esperado && m.pequenos.length === 0 && touchOk && m.cortados.length === 0;
      if (!ok) falhas++;
      console.log(`${String(largura).padStart(3)} px  ${t.nome.padEnd(20)} layout ${m.layout}  rolagem horizontal ${m.horizontal > 0 ? `${m.horizontal} px` : 'não'}  cortado: ${m.cortados.length ? m.cortados.slice(0, 3).join('; ') : 'nada'}  alvos < 44: ${m.pequenos.length ? m.pequenos.join('; ') : 'nenhum'}  touch-action none: ${m.comTouchNone.join(', ') || 'nenhum'}  ${ok ? 'ok' : 'FALHOU'}`);
      if (largura === 390) {
        const app = await p.screenshot();
        const figma = t.figma ? path.join(FIGMA, `${t.figma}.png`) : null;
        fs.writeFileSync(path.join(SAIDA, `portao14_${t.nome}.png`), ladoALado(app, figma && fs.existsSync(figma) ? figma : null));
      }
    }
    // Seleção: arrastar sobre o texto do jogo não seleciona nada; o menu do toque longo está desligado;
    // campos de texto continuam selecionáveis.
    {
      await p.keyboard.press('Escape');
      await aba(p, 'Heróis');
      await espera(p);
      const caixa = await p.locator('main h2').filter({ visible: true }).first().boundingBox();
      await p.mouse.move(caixa.x + 2, caixa.y + caixa.height / 2);
      await p.mouse.down();
      await p.mouse.move(caixa.x + caixa.width - 2, caixa.y + caixa.height / 2, { steps: 6 });
      await p.mouse.up();
      const sel = await p.evaluate(() => {
        const texto = window.getSelection()?.toString() ?? '';
        window.getSelection()?.removeAllRanges();
        const corpo = getComputedStyle(document.body);
        const campo = document.createElement('input');
        document.body.append(campo);
        const noCampo = getComputedStyle(campo).userSelect;
        campo.remove();
        return { texto, corpo: corpo.userSelect, callout: corpo.webkitTouchCallout ?? corpo.getPropertyValue('-webkit-touch-callout'), noCampo };
      });
      const ok = sel.texto === '' && sel.corpo === 'none' && sel.noCampo !== 'none';
      if (!ok) falhas++;
      console.log(`${String(largura).padStart(3)} px  seleção              arrastar selecionou "${sel.texto}"  corpo ${sel.corpo}  campo ${sel.noCampo}  toque longo ${sel.callout || '?'}  ${ok ? 'ok' : 'FALHOU'}`);
    }
    // Pinça com dois dedos (toques reais pelo protocolo do Chrome): abrir aproxima, fechar afasta, sempre em zoom inteiro.
    if (largura <= 600) {
      await p.keyboard.press('Escape');
      await aba(p, 'Vila');
      await visao(p, 'Reino');
      await espera(p);
      const r = await pinca(p);
      const ok = r.depoisDeAbrir > r.antes && r.depoisDeFechar < r.depoisDeAbrir && [r.antes, r.depoisDeAbrir, r.depoisDeFechar].every(Number.isInteger);
      if (!ok) falhas++;
      console.log(`${String(largura).padStart(3)} px  pinça                zoom ${r.antes} -> abrir ${r.depoisDeAbrir} -> fechar ${r.depoisDeFechar}  ${ok ? 'ok' : 'FALHOU'}`);
    }
    if (erros.length) {
      falhas++;
      console.log(`${largura} px  erros na página: ${erros.join('; ')}`);
    }
    await contexto.close();
  }
  await navegador.close();
  if (falhas) {
    console.error(`${falhas} verificação(ões) falharam`);
    process.exit(1);
  }
  console.log('tudo ok; capturas em docs/referencia/portao14_*.png (app à esquerda, Figma à direita)');
})().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
