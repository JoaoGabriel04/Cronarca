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
// - desktop em 1280, 1366, 1440, 1920 e 2560 de largura: cada sprite em escala inteira e no ponto do
//   Figma, só sprites da lista fechada, nada da decoração do celular à vista.
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

  // Desktop (Tela inicial v2): em cada tela, cada sprite com escala INTEIRA (largura em tela = arte x n,
  // n = round(k * u / 6)), canto no pixel de tela e pé e centro no ponto do Figma (até 1 px); nada da
  // decoração do celular à vista; só sprites da lista fechada, nenhum SVG de sprite.
  {
    const LISTA = ['pinho0', 'pinho1', 'castelo', 'cavaleiro', 'fogueira', 'flores', 'placa', 'cerca'];
    // 3440x1440 (2,39:1) fica de fora da cobertura da sangria de propósito: ali o degradê de apoio aparece.
    const SEM_COBERTURA = ['3440x1440'];
    for (const [w, h] of [[1280, 720], [1366, 768], [1440, 900], [1864, 935], [1920, 1080], [2560, 1080], [1024, 768], [2560, 1440], [3440, 1440]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } });
      const p = await ctx.newPage();
      for (const rota of ['/', '/login']) {
        await p.goto(APP + rota, { timeout: 120_000 });
        await p.waitForTimeout(1200);
        const r = await p.evaluate((lista) => {
          const raiz = getComputedStyle(document.documentElement);
          const u = parseFloat(raiz.getPropertyValue('--u'));
          const z = parseFloat(raiz.getPropertyValue('--z'));
          const palco = document.querySelector('.cena-palco').getBoundingClientRect();
          const sprites = [...document.querySelectorAll('.cena-palco > .sprite')];
          const problemas = [];
          for (const s of sprites) {
            const img = s.querySelector('img').getBoundingClientRect();
            const k = Number(/k(\d)/.exec(s.className)[1]);
            if (k !== 3 && k !== 4) problemas.push(`escala k${k} fora de {3, 4}`);
            const arte = Number(s.style.getPropertyValue('--a'));
            const n = Math.max(1, Math.round((k * u) / 6));
            const nome = /\/sprites\/cena\/([a-z]+\d?)_/.exec(s.querySelector('img').getAttribute('src'))?.[1];
            if (!lista.includes(nome)) problemas.push(`sprite fora da lista: ${nome}`);
            if (/\.svg/.test(s.querySelector('img').getAttribute('src'))) problemas.push(`SVG: ${nome}`);
            if (Math.abs(img.width - arte * n) > 0.02 || Math.abs(img.height - arte * n) > 0.02) problemas.push(`${nome} k${k}: ${img.width.toFixed(2)} px, esperado ${arte * n}`);
            if (Math.abs(img.left - Math.round(img.left)) > 0.02 || Math.abs(img.top - Math.round(img.top)) > 0.02) problemas.push(`${nome}: canto fora do pixel (${img.left.toFixed(2)}, ${img.top.toFixed(2)})`);
            const cx = Number(s.style.getPropertyValue('--cx')), by = Number(s.style.getPropertyValue('--by'));
            const centro = img.left + img.width / 2 - (palco.left + cx * z);
            const pe = img.top + img.height - (palco.top + by * z);
            if (Math.abs(centro) > 1.01 || Math.abs(pe) > 1.01) problemas.push(`${nome}: fora do ponto do Figma (centro ${centro.toFixed(2)}, pé ${pe.toFixed(2)})`);
          }
          // Fundo largo: cobre a janela, a janela central coincide com o palco e tudo cai em pixel inteiro.
          const fb = document.querySelector('.cena-fundo').getBoundingClientRect();
          const inteiro = (v) => Math.abs(v - Math.round(v)) <= 0.02;
          const cobre = fb.left <= 0.02 && fb.top <= 0.02 && fb.right >= innerWidth - 0.02 && fb.bottom >= innerHeight - 0.02;
          if (!inteiro(palco.left) || !inteiro(palco.top)) problemas.push(`palco fora do pixel (${palco.left}, ${palco.top})`);
          if (!inteiro(fb.left) || !inteiro(fb.top) || Math.abs(fb.width - 420 * u) > 0.02 || Math.abs(fb.height - 210 * u) > 0.02) problemas.push(`fundo fora do pixel ou da escala (${fb.left}, ${fb.top}, ${fb.width}x${fb.height})`);
          if (Math.abs(fb.left + 90 * u - palco.left) > 0.02 || Math.abs(fb.top + 30 * u - palco.top) > 0.02) problemas.push('janela central do fundo fora do palco');
          if (!/inicio_largo\.png/.test(document.querySelector('.cena-fundo').getAttribute('src'))) problemas.push('fundo não é o inicio_largo.png');
          const celularVisivel = [...document.querySelectorAll('.cena-celular-paisagem')].filter((e) => getComputedStyle(e).display !== 'none').length;
          return { u, cobre, sprites: sprites.length, problemas, celularVisivel, horizontal: document.documentElement.scrollWidth - innerWidth };
        }, LISTA);
        console.log(`desktop ${String(w).padStart(4)}x${String(h).padEnd(4)} ${rota.padEnd(7)} u=${r.u} ${r.sprites} sprites, problemas ${r.problemas.length}, celular visível ${r.celularVisivel}, rolagem horizontal ${r.horizontal > 0 ? 'sim' : 'não'}, fundo cobre ${r.cobre ? 'sim' : 'NÃO'}`);
        if (!r.cobre && !SEM_COBERTURA.includes(`${w}x${h}`)) falhou(`desktop ${w}x${h} ${rota}: o fundo largo não cobre a janela`);
        for (const pr of r.problemas.slice(0, 4)) console.log('    - ' + pr);
        if (r.problemas.length) falhou(`desktop ${w}x${h} ${rota}: ${r.problemas.length} problema(s) de escala ou posição`);
        if (r.celularVisivel) falhou(`desktop ${w}x${h} ${rota}: decoração do celular aparecendo`);
        if (r.horizontal > 0) falhou(`desktop ${w}x${h} ${rota}: rolagem horizontal`);
        if (w === 1440) await p.screenshot({ path: path.join(SAIDA, `depois_${rota === '/' ? 'inicio' : 'login'}_1440.png`) });
        if (r.sprites !== (rota === '/' ? 15 : 6)) falhou(`desktop ${w}x${h} ${rota}: ${r.sprites} sprites (esperado ${rota === '/' ? 15 : 6})`);
        await p.screenshot({ path: path.join(SAIDA, `depois_fundo_${rota === '/' ? 'inicio' : 'login'}_${w}x${h}.png`) });
      }
      await ctx.close();
    }
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
