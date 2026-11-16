// Conferência do Portão 16 (`make conferir-lore`): prólogo, chip Objetivo,
// painel dos objetivos, Diário e o Marco da era, em 1440, 601, 390 e 360 px.
// Para o prólogo abrir, a resposta do estado que a página recebe vem com
// prologoVisto = false; as ações ficam bloqueadas (nada muda no banco).
// Em cada passo: sem rolagem horizontal e, até 600 px, alvos de 44 px.
// Capturas em docs/referencia/lore/.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const APP = process.env.APP_URL || 'http://localhost:3000';
const SAIDA = path.resolve(__dirname, '..', 'docs/referencia/lore');
const LARGURAS = [[1440, 900], [601, 900], [390, 844], [360, 800]];
const PROLOGO_1 = 'O Relógio do Mundo parou numa hora que ninguém lembra.';
const PROLOGO_3 = 'O Sábio guarda os livros que restaram.';

function semPrologoVisto(o) {
  if (o && typeof o === 'object') {
    if ('prologoVisto' in o && Array.isArray(o.diario)) o.prologoVisto = false;
    for (const v of Object.values(o)) semPrologoVisto(v);
  }
  return o;
}

const medir = (p, largura) => p.evaluate((largura) => {
  const horizontal = document.documentElement.scrollWidth - innerWidth;
  const dialogo = document.querySelector('[role="dialog"]');
  const raiz = dialogo || document;
  const visivel = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const pequenos = largura > 600 ? [] : [...raiz.querySelectorAll('button, a[href], [role="button"], summary')]
    .filter(visivel)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 43.5 || r.height < 43.5)
    .map(({ el, r }) => `${(el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  return { horizontal, pequenos };
}, largura);

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const b = await chromium.launch();
  const s = await b.newContext();
  const login = await s.request.post(`${APP}/api/auth/login`, { headers: { Origin: APP }, data: { email: 'dev@cronarca.local', senha: 'cronarca' } });
  if (!login.ok()) throw new Error(`login falhou (${login.status()}): rode \`make seed\``);
  const storageState = await s.storageState();
  await s.close();
  let falhas = 0;
  for (const [w, h] of LARGURAS) {
    const celular = w <= 600;
    const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: celular, hasTouch: celular, deviceScaleFactor: 1, storageState });
    const p = await c.newPage();
    const erros = [];
    p.on('pageerror', (e) => erros.push(String(e)));
    await p.route('**/api/game/actions', (r) => r.abort());
    await p.route('**/api/game/state', async (r) => {
      const x = await r.fetch();
      await r.fulfill({ response: x, json: semPrologoVisto(await x.json()) });
    });
    await p.goto(`${APP}/jogo`, { timeout: 120000 });
    await p.waitForSelector('[data-pronto="sim"]', { timeout: 120000 });
    await p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    const checagens = [];
    const passo = async (nome, ok) => {
      const m = await medir(p, w);
      const certo = ok && m.horizontal <= 0 && m.pequenos.length === 0;
      checagens.push(`${nome} ${certo ? 'ok' : `FALHOU${m.horizontal > 0 ? ` (rolagem ${m.horizontal} px)` : ''}${m.pequenos.length ? ` (alvos < 44: ${m.pequenos.join('; ')})` : ''}${ok ? '' : ' (conteúdo)'}`}`);
      if (!certo) falhas++;
      await p.screenshot({ path: path.join(SAIDA, `${nome}_${w}.png`) });
    };
    // 1. Prólogo: abre sozinho, 3 cartões, Continuar e Começar.
    const dialogo = p.locator('[role="dialog"]').first();
    await dialogo.waitFor({ timeout: 15000 });
    await p.waitForTimeout(500);
    await passo('prologo1', (await dialogo.innerText()).includes(PROLOGO_1));
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await dialogo.getByRole('button', { name: 'Continuar' }).click();
    await p.waitForTimeout(300);
    await passo('prologo3', (await dialogo.innerText()).includes(PROLOGO_3));
    await dialogo.getByRole('button', { name: 'Começar' }).click();
    await p.waitForTimeout(500);
    // 2. Chip Objetivo visível com o passo principal.
    const chip = p.locator('button[aria-label^="Objetivo:"]').filter({ visible: true }).first();
    const textoChip = (await chip.getAttribute('aria-label')) || '';
    await passo('chip', (await chip.isVisible()) && textoChip.length > 'Objetivo: . Abrir os objetivos'.length);
    // 3. Painel dos objetivos: as 3 trilhas.
    await chip.click();
    await dialogo.waitFor();
    await p.waitForTimeout(400);
    const trilhas = await dialogo.locator('li').count();
    await passo('objetivos', trilhas === 3);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    // 4. Diário: o prólogo liberado, os bloqueados como "?".
    await p.getByRole('button', { name: /^Diário/ }).filter({ visible: true }).first().click();
    await dialogo.waitFor();
    await p.waitForTimeout(400);
    const texto = await dialogo.innerText();
    const bloqueados = await dialogo.getByText('?', { exact: true }).count();
    await dialogo.locator('summary').first().click();
    await p.waitForTimeout(300);
    await passo('diario', texto.includes('O Relógio parado') && bloqueados >= 1);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    // 5. Eras: o Marco da era acima dos objetivos.
    await p.locator('nav[aria-label="Telas do jogo"] button', { hasText: 'Eras' }).click();
    await p.waitForTimeout(600);
    await passo('eras', await p.getByText('Marco da era').first().isVisible());
    const ok = erros.length === 0;
    if (!ok) falhas++;
    console.log(`${String(w).padStart(4)} px  objetivo "${textoChip.replace(/^Objetivo: /, '').replace(/\. Abrir os objetivos$/, '')}"  ${checagens.join('  ')}  erros: ${erros.join('; ') || 'nenhum'}`);
    await c.close();
  }
  await b.close();
  if (falhas) {
    console.log(`${falhas} verificação(ões) falharam`);
    process.exit(1);
  }
  console.log('tudo ok; capturas em docs/referencia/lore/');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
