// Conferência do Portão 18a (`make conferir-teto`): Melhorar do Armazém e do
// Celeiro com o teto efetivo do Legado 8, em 390 px. O Legado 8 entra só na
// resposta do estado que a página recebe: nada muda no banco. Confere o texto
// "Guarda 300 (madeira 580)" / "Guarda 400 de comida", rolagem horizontal e
// alvos de 44 px; grava as capturas em docs/referencia/.
const path = require('node:path');
const { chromium } = require('playwright');
const APP = process.env.APP_URL || 'http://localhost:3000';
const SAIDA = path.resolve(__dirname, '..', 'docs/referencia');
const ESPERADO = { armazem_1: ['Guarda 300 (madeira 580)', 'Guarda 465 (madeira 580)'], celeiro_1: ['Guarda 400 de comida', 'Guarda 465 de comida'] };
const NUCLEO = { x: 1312, y: 928 };
const SLOTS = { armazem_1: { x: 271, y: 228 }, celeiro_1: { x: 166, y: 279 } };
function comLegado(obj) {
  if (obj && typeof obj === 'object') {
    if (obj.reliquias && obj.reliquias.niveis) obj.reliquias.niveis.legado = 8;
    for (const v of Object.values(obj)) comLegado(v);
  }
  return obj;
}
(async () => {
  const b = await chromium.launch();
  const s = await b.newContext();
  const login = await s.request.post(`${APP}/api/auth/login`, { headers: { Origin: APP }, data: { email: 'dev@cronarca.local', senha: 'cronarca' } });
  if (!login.ok()) throw new Error('login ' + login.status());
  const st = await s.storageState(); await s.close();
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, storageState: st });
  const p = await c.newPage();
  await p.route('**/api/game/state', async (rota) => {
    const r = await rota.fetch();
    const corpo = comLegado(await r.json());
    await rota.fulfill({ response: r, json: corpo });
  });
  await p.goto(`${APP}/jogo`, { timeout: 120000 });
  await p.waitForSelector('[data-pronto="sim"]', { timeout: 120000 });
  await p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await p.locator('nav[aria-label="Telas do jogo"] button', { hasText: 'Vila' }).click();
  await p.locator('[data-layout] button', { hasText: /^Vila$/ }).first().click();
  await p.waitForTimeout(900);
  const saida = [];
  let falhas = 0;
  for (const [slot, pos] of Object.entries(SLOTS)) {
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const alvo = await p.evaluate((w) => {
      const m = document.querySelector('[data-zoom]');
      const cv = m.querySelector('canvas').getBoundingClientRect();
      const z = Number(m.dataset.zoom);
      return { x: cv.left + (w.x - Number(m.dataset.camX)) * z + cv.width / 2, y: cv.top + (w.y - Number(m.dataset.camY)) * z + cv.height / 2 };
    }, { x: pos.x + NUCLEO.x + 24, y: pos.y + NUCLEO.y + 23 });
    const cv = await p.locator('[data-zoom] canvas').first().boundingBox();
    // Fora do canvas: arrasta o mapa até o alvo ficar no centro.
    if (alvo.x < cv.x + 20 || alvo.x > cv.x + cv.width - 20 || alvo.y < cv.y + 20 || alvo.y > cv.y + cv.height - 20) {
      const cx = cv.x + cv.width / 2, cy = cv.y + cv.height / 2;
      const dx = cx - alvo.x, dy = cy - alvo.y;
      await p.mouse.move(cx, cy); await p.mouse.down();
      await p.mouse.move(cx + dx, cy + dy, { steps: 12 }); await p.mouse.up();
      await p.waitForTimeout(500);
      Object.assign(alvo, await p.evaluate((w) => {
        const m = document.querySelector('[data-zoom]');
        const c2 = m.querySelector('canvas').getBoundingClientRect();
        const z = Number(m.dataset.zoom);
        return { x: c2.left + (w.x - Number(m.dataset.camX)) * z + c2.width / 2, y: c2.top + (w.y - Number(m.dataset.camY)) * z + c2.height / 2 };
      }, { x: pos.x + NUCLEO.x + 24, y: pos.y + NUCLEO.y + 23 }));
    }
    await p.touchscreen.tap(alvo.x, alvo.y);
    const dialogo = p.locator('[role="dialog"]').first();
    await dialogo.waitFor({ timeout: 10000 });
    await p.waitForTimeout(600);
    const texto = (await dialogo.innerText()).replace(/\s+/g, ' ');
    const m = await p.evaluate(() => ({ horizontal: document.documentElement.scrollWidth - innerWidth }));
    const pequenos = await dialogo.locator('button').evaluateAll((bs) => bs.filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && (r.width < 43.5 || r.height < 43.5); }).map((x) => (x.getAttribute('aria-label') || x.textContent).trim()));
    await p.screenshot({ path: path.join(SAIDA, `portao18a_melhorar_${slot}_390.png`) });
    const ok = m.horizontal <= 0 && pequenos.length === 0 && ESPERADO[slot].every((t) => texto.includes(t));
    if (!ok) falhas++;
    saida.push(`${ok ? 'ok     ' : 'FALHOU '} ${slot}: rolagem horizontal ${m.horizontal > 0 ? m.horizontal : 'não'}; alvos < 44: ${pequenos.join(', ') || 'nenhum'}; texto: ${texto.match(/Guarda[^A-Z]*/g)?.join(' | ')}`);
  }
  console.log(saida.join('\n'));
  await b.close();
  if (falhas) process.exit(1);
  console.log('tudo ok; capturas em docs/referencia/portao18a_*.png');
})().catch((e) => { console.error(e); process.exit(1); });
