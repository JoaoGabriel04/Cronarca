// Conferência do Início e do Login no celular (portão Início/Login no celular
// + cena animada). Roda na imagem do Playwright (`make conferir-inicio`), com o
// app de pé e a conta de desenvolvimento (`make seed`).
//
// - 360x800, 390x844 e 430x932 (em pé) e 844x390 (deitado): sem rolagem
//   horizontal, todo botão/link visível com pelo menos 44 x 44, os três
//   botões do menu e o cartão de login alcançáveis rolando a coluna;
// - teclado simulado (390x844 -> 390x544 com o e-mail focado): o campo ativo e
//   o Entrar visíveis, logo compacta (html[data-teclado]);
// - login pelo formulário em 390 (um login só: o backend limita tentativas);
// - fps da cena do Início em 390 com a CPU 4x mais lenta;
// - desktop 1440: cada sprite no lugar do palco (dados da cena) e nada da
//   decoração do celular à vista.
// Grava capturas em docs/referencia/cena/.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const APP = process.env.APP_URL || 'http://localhost:3000';
const SAIDA = path.resolve(__dirname, '..', 'docs/referencia/cena');
const TAMANHOS = [['360', 360, 800], ['390', 390, 844], ['430', 430, 932], ['deitado', 844, 390]];
const falhas = [];
const falhou = (msg) => {
  falhas.push(msg);
  console.log('  FALHOU: ' + msg);
};

async function medir(p) {
  return p.evaluate(() => {
    const cena = document.querySelector('.cena');
    const horizontal = Math.max(cena.scrollWidth - cena.clientWidth, document.documentElement.scrollWidth - innerWidth);
    const pequenos = [...document.querySelectorAll('a[href], button')]
      .filter((el) => {
        const s = getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
      })
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 43.5 || r.height < 43.5)
      .map(({ el, r }) => `${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    return { horizontal, pequenos, teclado: document.documentElement.hasAttribute('data-teclado') };
  });
}

/** Rola até o elemento e confere que ficou inteiro na tela. */
async function alcancavel(p, locator, nome) {
  await locator.scrollIntoViewIfNeeded();
  const r = await locator.boundingBox();
  const vp = p.viewportSize();
  if (!r || r.y < -1 || r.y + r.height > vp.height + 1 || r.x < -1 || r.x + r.width > vp.width + 1) falhou(`${nome} fora da tela (${JSON.stringify(r)})`);
}

const celular = (b, w, h) => b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const b = await chromium.launch();

  for (const [nome, w, h] of TAMANHOS) {
    const ctx = await celular(b, w, h);
    const p = await ctx.newPage();
    for (const rota of ['inicio', 'login']) {
      await p.goto(APP + (rota === 'inicio' ? '/' : '/login'), { timeout: 120_000 });
      await p.waitForTimeout(1200);
      await p.screenshot({ path: path.join(SAIDA, `depois_${rota}_${nome}.png`) });
      const m = await medir(p);
      console.log(`${nome.padEnd(8)} ${rota.padEnd(7)} rolagem horizontal ${m.horizontal > 0 ? m.horizontal + ' px' : 'não'}  alvos < 44: ${m.pequenos.join(', ') || 'nenhum'}`);
      if (m.horizontal > 0) falhou(`${nome} ${rota}: rolagem horizontal de ${m.horizontal} px`);
      if (m.pequenos.length) falhou(`${nome} ${rota}: alvos pequenos ${m.pequenos.join(', ')}`);
      if (rota === 'inicio') {
        for (const t of ['Continuar Crônica', 'Nova Crônica', 'Ranking dos Reinos']) await alcancavel(p, p.getByRole('link', { name: t }), `${nome} menu "${t}"`);
      } else {
        await alcancavel(p, p.getByRole('button', { name: 'Entrar', exact: true }), `${nome} botão Entrar`);
        await alcancavel(p, p.getByRole('button', { name: 'Criar nova conta' }), `${nome} "Criar nova conta"`);
      }
    }
    await ctx.close();
  }

  // Teclado simulado: o viewport encolhe 300 px com o e-mail focado (como o teclado do sistema).
  {
    const ctx = await celular(b, 390, 844);
    const p = await ctx.newPage();
    await p.goto(APP + '/login', { timeout: 120_000 });
    await p.waitForTimeout(800);
    await p.getByLabel('E-mail').focus();
    await p.setViewportSize({ width: 390, height: 544 });
    await p.waitForTimeout(900);
    const m = await medir(p);
    const campo = await p.getByLabel('E-mail').boundingBox();
    const entrar = await p.getByRole('button', { name: 'Entrar', exact: true }).boundingBox();
    const dentro = (r) => r && r.y >= 0 && r.y + r.height <= 544;
    console.log(`teclado  data-teclado ${m.teclado}  e-mail ${dentro(campo) ? 'visível' : 'fora'}  Entrar ${dentro(entrar) ? 'visível' : 'fora'}`);
    if (!m.teclado) falhou('teclado: html[data-teclado] não ligou');
    if (!dentro(campo)) falhou(`teclado: campo e-mail fora da área visível ${JSON.stringify(campo)}`);
    if (!dentro(entrar)) falhou(`teclado: Entrar fora da área visível ${JSON.stringify(entrar)}`);
    await p.screenshot({ path: path.join(SAIDA, 'depois_login_390_teclado.png') });
    await ctx.close();
  }

  // Login de verdade pelo formulário (390).
  {
    const ctx = await celular(b, 390, 844);
    const p = await ctx.newPage();
    await p.goto(APP + '/login', { timeout: 120_000 });
    await p.getByLabel('E-mail').fill('dev@cronarca.local');
    await p.getByLabel('Senha').fill('cronarca');
    await p.getByRole('button', { name: 'Entrar', exact: true }).tap();
    try {
      await p.waitForURL(/\/jogo/, { timeout: 60_000 });
      console.log('login    pelo formulário em 390: ok');
    } catch {
      falhou('login pelo formulário não chegou a /jogo (' + p.url() + ')');
    }
    await ctx.close();
  }

  // fps do Início no celular com a CPU 4x mais lenta (cena inteira animada).
  {
    const ctx = await celular(b, 390, 844);
    const p = await ctx.newPage();
    await p.goto(APP + '/', { timeout: 120_000 });
    await p.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const fps = await p.evaluate(
      () =>
        new Promise((ok) => {
          const t = [];
          const passo = (agora) => {
            t.push(agora);
            if (agora - t[0] < 3000) requestAnimationFrame(passo);
            else ok({ media: (t.length - 1) / ((agora - t[0]) / 1000), pior: Math.max(...t.slice(1).map((x, i) => x - t[i])) });
          };
          requestAnimationFrame(passo);
        }),
    );
    console.log(`fps      Início 390, CPU 4x: média ${fps.media.toFixed(1)}, pior quadro ${fps.pior.toFixed(0)} ms`);
    if (fps.media < 50) falhou(`fps baixo no celular: ${fps.media.toFixed(1)}`);
    await ctx.close();
  }

  // Desktop: cada sprite no lugar do palco (zoom inteiro), nada da decoração do celular.
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    for (const rota of ['/', '/login']) {
      await p.goto(APP + rota, { timeout: 120_000 });
      await p.waitForTimeout(1200);
      const r = await p.evaluate(() => {
        const palco = document.querySelector('.cena-palco').getBoundingClientRect();
        const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--z'));
        const sprites = [...document.querySelectorAll('.cena-palco > .sprite')];
        const fora = sprites.filter((s) => {
          const img = s.querySelector('img').getBoundingClientRect();
          const x = palco.left + parseFloat(s.style.left) * z;
          const y = palco.top + parseFloat(s.style.top) * z;
          const l = parseFloat(s.style.width) * z;
          return Math.abs(img.left - x) > 0.5 || Math.abs(img.top - y) > 0.5 || Math.abs(img.width - l) > 0.5;
        }).length;
        const celularVisivel = [...document.querySelectorAll('.cena-celular-paisagem, .cena-celular-fileira')].filter((e) => getComputedStyle(e).display !== 'none').length;
        return { sprites: sprites.length, fora, celularVisivel };
      });
      console.log(`desktop  ${rota.padEnd(7)} ${r.sprites} sprites, fora do lugar ${r.fora}, decoração do celular visível ${r.celularVisivel}`);
      if (r.fora) falhou(`desktop ${rota}: ${r.fora} sprites fora do lugar`);
      if (r.celularVisivel) falhou(`desktop ${rota}: decoração do celular aparecendo`);
      await p.screenshot({ path: path.join(SAIDA, `depois_${rota === '/' ? 'inicio' : 'login'}_1440.png`) });
    }
    await ctx.close();
  }

  await b.close();
  if (falhas.length) {
    console.log(`\n${falhas.length} falha(s)`);
    process.exit(1);
  }
  console.log('\ntudo ok; capturas em docs/referencia/cena/');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
