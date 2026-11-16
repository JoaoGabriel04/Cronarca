// Conferência do portão de ajustes rápidos (`make conferir-aldeoes`): aldeões
// visíveis em qualquer zoom e largura, e os Ociosos em volta da fogueira.
// O estado de teste (todas as construções erguidas, Casa 10, 40 aldeões, dos
// quais 10 Ociosos) entra só na resposta do estado que a página recebe, e as
// ações ficam bloqueadas: nada muda no banco.
// - Reino em 1440 e 390 px e a praça da fogueira em 3x: capturas em
//   docs/referencia/aldeoes/;
// - fps arrastando o Reino (2x) por ~4 s com os 40 aldeões, em 1440;
// - a ajuda aberta no cartão Aldeões e na Guilda (texto visível, sem emoji, 44 px no celular).
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const APP = process.env.APP_URL || 'http://localhost:3000';
const SAIDA = path.resolve(__dirname, '..', 'docs/referencia/aldeoes');
const OFICIOS = ['fazendeiro', 'lenhador', 'mineiro', 'sabio', 'ferreiro'];
/** Centro da fogueira em mundo (origem do núcleo + canto + meio do sprite de 32). */
const FOGUEIRA = { x: 1312 + 176 + 16, y: 928 + 250 + 16 };

function preparar(o) {
  if (o && typeof o === 'object') {
    if (o.slots && o.reliquias && Array.isArray(o.aldeoes)) {
      for (const k of Object.keys(o.slots)) o.slots[k] = { ...o.slots[k], nivel: Math.max(1, o.slots[k].nivel), obraAte: null };
      o.slots.casa_1.nivel = 10;
      o.aldeoes = [...Array.from({ length: 30 }, (_, i) => ({ oficio: OFICIOS[i % 5] })), ...Array.from({ length: 10 }, () => ({ oficio: 'ocioso' }))];
    }
    for (const v of Object.values(o)) preparar(v);
  }
  return o;
}

const camera = (p) => p.evaluate(() => {
  const m = document.querySelector('[data-zoom]');
  const c = m.querySelector('canvas').getBoundingClientRect();
  return { z: Number(m.dataset.zoom), x: Number(m.dataset.camX), y: Number(m.dataset.camY), cv: { x: c.left, y: c.top, w: c.width, h: c.height } };
});
const naTela = (c, w) => ({ x: c.cv.x + (w.x - c.x) * c.z + c.cv.w / 2, y: c.cv.y + (w.y - c.y) * c.z + c.cv.h / 2 });

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const b = await chromium.launch();
  const s = await b.newContext();
  const login = await s.request.post(`${APP}/api/auth/login`, { headers: { Origin: APP }, data: { email: 'dev@cronarca.local', senha: 'cronarca' } });
  if (!login.ok()) throw new Error(`login falhou (${login.status()}): rode \`make seed\``);
  const storageState = await s.storageState();
  await s.close();
  let falhas = 0;
  for (const [nome, w, h, celular] of [['1440', 1440, 900, false], ['390', 390, 844, true]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: celular, hasTouch: celular, deviceScaleFactor: 1, storageState });
    const p = await c.newPage();
    const erros = [];
    p.on('pageerror', (e) => erros.push(String(e)));
    await p.route('**/api/game/actions', (r) => r.abort());
    await p.route('**/api/game/state', async (r) => {
      const x = await r.fetch();
      await r.fulfill({ response: x, json: preparar(await x.json()) });
    });
    await p.goto(`${APP}/jogo`, { timeout: 120000 });
    await p.waitForSelector('[data-pronto="sim"]', { timeout: 120000 });
    await p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    const visao = (n) => p.locator('[data-layout] button', { hasText: new RegExp(`^${n}$`) }).first().click();
    await visao('Reino');
    await p.waitForTimeout(1200);
    const reino = await camera(p);
    await p.screenshot({ path: path.join(SAIDA, `reino_${nome}.png`) });
    // Praça no Reino (2x) e na Vila (3x no desktop), recortadas em volta da fogueira.
    for (const [rotulo, cam] of [['reino', reino]]) {
      const f = naTela(cam, FOGUEIRA);
      await p.screenshot({ path: path.join(SAIDA, `praca_${rotulo}_${nome}.png`), clip: { x: Math.max(0, f.x - 150), y: Math.max(0, f.y - 120), width: Math.min(300, w), height: 240 } });
    }
    await visao('Vila');
    await p.waitForTimeout(1200);
    const vila = await camera(p);
    const f = naTela(vila, FOGUEIRA);
    await p.screenshot({ path: path.join(SAIDA, `praca_vila_${nome}.png`), clip: { x: Math.max(0, Math.min(w - 420, f.x - 300)), y: Math.max(0, f.y - 170), width: Math.min(420, w), height: 330 } });
    // A praça em cada zoom (1x a 4x), centrada na fogueira: o tamanho dos aldeões ao lado das construções.
    if (!celular) {
      const zoomPara = async (alvo) => {
        for (let i = 0; i < 6 && (await camera(p)).z !== alvo; i++) {
          const botao = p.getByRole('button', { name: (await camera(p)).z < alvo ? 'Aproximar' : 'Afastar' });
          if (!(await botao.isEnabled())) return false; // fora do mínimo/máximo da tela
          await botao.click();
          await p.waitForTimeout(500);
        }
        return (await camera(p)).z === alvo;
      };
      // O controle de zoom fica no Reino; arrasta o mapa até a fogueira ficar no centro.
      await visao('Reino');
      await p.waitForTimeout(800);
      const centrarFogueira = async () => {
        const cam = await camera(p);
        const f = naTela(cam, FOGUEIRA);
        const cx = cam.cv.x + cam.cv.w / 2, cy = cam.cv.y + cam.cv.h / 2;
        await p.mouse.move(cx, cy);
        await p.mouse.down();
        await p.mouse.move(cx + (cx - f.x), cy + (cy - f.y), { steps: 12 });
        await p.mouse.up();
        await p.waitForTimeout(500);
      };
      for (const z of [1, 2, 3, 4]) {
        if (!(await zoomPara(z))) {
          console.log(`${nome.padStart(4)} px  zoom ${z}x: o jogo não deixa chegar nesta tela (mínimo/máximo)`);
          continue;
        }
        await centrarFogueira();
        const cam = await camera(p);
        const f = naTela(cam, FOGUEIRA);
        const lado = 100 * z;
        await p.screenshot({ path: path.join(SAIDA, `praca_zoom${z}x_${nome}.png`), clip: { x: Math.max(cam.cv.x, f.x - lado * 1.5), y: Math.max(cam.cv.y, f.y - lado), width: Math.min(lado * 3, cam.cv.w), height: Math.min(lado * 2, cam.cv.h) } });
      }
    }
    await visao('Vila');
    await p.waitForTimeout(600);
    // Ajuda aberta nos dois lugares: o cartão Aldeões (Vila) e a Guilda (Heróis).
    const ajudas = [];
    for (const [aba, rotulo, inicio] of [['Vila', 'O que são aldeões?', 'Gente da vila.'], ['Heróis', 'O que são aventureiros?', 'Heróis da guilda.']]) {
      await p.locator('nav[aria-label="Telas do jogo"] button', { hasText: aba }).click();
      await p.waitForTimeout(500);
      const resumo = p.locator('summary', { hasText: rotulo }).filter({ visible: true }).first();
      await resumo.scrollIntoViewIfNeeded();
      await resumo.click();
      const texto = p.getByText(inicio).filter({ visible: true }).first();
      const visivel = await texto.isVisible();
      const emoji = /\p{Extended_Pictographic}/u.test(await texto.innerText());
      const caixa = await resumo.boundingBox();
      await p.screenshot({ path: path.join(SAIDA, `ajuda_${aba === 'Vila' ? 'aldeoes' : 'guilda'}_${nome}.png`) });
      ajudas.push({ rotulo, ok: visivel && !emoji && (!celular || caixa.height >= 43.5) });
      await resumo.click();
    }
    await p.locator('nav[aria-label="Telas do jogo"] button', { hasText: 'Vila' }).click();
    await p.waitForTimeout(400);
    let fps = null;
    if (!celular) {
      // fps arrastando o Reino em 2x com os 40 aldeões.
      await visao('Reino');
      await p.waitForTimeout(800);
      const cam = await camera(p);
      const cx = cam.cv.x + cam.cv.w / 2, cy = cam.cv.y + cam.cv.h / 2;
      await p.mouse.move(cx, cy);
      await p.mouse.down();
      const medir = p.evaluate(() => new Promise((ok) => { const t = []; const passo = (a) => { t.push(a); if (a - t[0] < 4000) requestAnimationFrame(passo); else ok((t.length - 1) / ((a - t[0]) / 1000)); }; requestAnimationFrame(passo); }));
      for (let i = 0; i < 40; i++) await p.mouse.move(cx + Math.sin(i / 4) * 200, cy + Math.cos(i / 5) * 120, { steps: 4 });
      fps = await medir;
      await p.mouse.up();
    }
    const ok = erros.length === 0 && (fps === null || fps >= 50) && ajudas.every((x) => x.ok);
    if (!ok) falhas++;
    console.log(`${nome.padStart(4)} px  Reino ${reino.z}x, Vila ${vila.z}x${fps === null ? '' : `  fps arrastando o Reino com 40 aldeões: ${fps.toFixed(1)}`}  ajuda: ${ajudas.map((x) => `${x.rotulo} ${x.ok ? 'ok' : 'FALHOU'}`).join(', ')}  erros: ${erros.join('; ') || 'nenhum'}  ${ok ? 'ok' : 'FALHOU'}`);
    await c.close();
  }
  await b.close();
  if (falhas) process.exit(1);
  console.log('tudo ok; capturas em docs/referencia/aldeoes/');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
