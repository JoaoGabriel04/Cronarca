// Conferência do Portão 18b (`make conferir-falha`): a Falha na tela de Eras e
// no modal de Ascensão, em 390 e 1440 px. A Falha 3 e os objetivos cumpridos
// entram só na resposta do estado que a página recebe: nada muda no banco, e o
// modal é fechado com Voltar (nunca ascende). Confere a etiqueta "Falha 3", o
// "Ao ascender: Falha 3 → 4" com os efeitos (sem a Cripta enquanto o acréscimo
// for 0), a lore, rolagem horizontal e, em 390, alvos de 44 px.
const path = require('node:path');
const { chromium } = require('playwright');

const APP = process.env.APP_URL || 'http://localhost:3000';
const SAIDA = path.resolve(__dirname, '..', 'docs/referencia');
const FALHA = 3;

/** Falha 3 e os três objetivos da Era I na visão (para o botão Ascender abrir o modal). */
function preparar(obj) {
  if (obj && typeof obj === 'object') {
    if ('falha' in obj && obj.reliquias && obj.pesquisas) {
      obj.falha = FALHA;
      if (!obj.pesquisas.concluidas.includes('carta_real')) obj.pesquisas.concluidas.push('carta_real');
      obj.objetivos.criptaVencida = true;
      while (obj.aldeoes.length < 40) obj.aldeoes.push({ oficio: 'fazendeiro' });
    }
    for (const v of Object.values(obj)) preparar(v);
  }
  return obj;
}

(async () => {
  const b = await chromium.launch();
  const s = await b.newContext();
  const login = await s.request.post(`${APP}/api/auth/login`, { headers: { Origin: APP }, data: { email: 'dev@cronarca.local', senha: 'cronarca' } });
  if (!login.ok()) throw new Error(`login falhou (${login.status()}): rode \`make seed\``);
  const storageState = await s.storageState();
  await s.close();
  let falhas = 0;
  for (const [nome, w, h, celular] of [['390', 390, 844, true], ['1440', 1440, 900, false]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, isMobile: celular, hasTouch: celular, deviceScaleFactor: 1, storageState });
    const p = await c.newPage();
    // Bloqueia ações: nada desta conferência chega ao servidor.
    await p.route('**/api/game/actions', (rota) => rota.abort());
    await p.route('**/api/game/state', async (rota) => {
      const r = await rota.fetch();
      await rota.fulfill({ response: r, json: preparar(await r.json()) });
    });
    await p.goto(`${APP}/jogo`, { timeout: 120000 });
    await p.waitForSelector('[data-pronto="sim"]', { timeout: 120000 });
    await p.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await p.locator('nav[aria-label="Telas do jogo"] button', { hasText: 'Eras' }).click();
    await p.waitForTimeout(700);
    const painel = p.locator('main');
    const etiqueta = await p.getByText(`Falha ${FALHA}`, { exact: true }).first().isVisible();
    const proximo = p.getByText(`Ao ascender: Falha ${FALHA} → ${FALHA + 1}`).first();
    await proximo.scrollIntoViewIfNeeded();
    const textoEras = (await painel.innerText()).replace(/\s+/g, ' ');
    const efeitos = textoEras.includes('Obras e pesquisas 12% mais lentas') && textoEras.includes('Estradas Reais e Carta Real 20% mais caras');
    const lore = textoEras.includes('A cada recomeço, o Relógio falha mais.');
    const semCripta = !/Cripta[^.]*perigo/.test(textoEras);
    const medir = () => p.evaluate((cel) => {
      const horizontal = document.documentElement.scrollWidth - innerWidth;
      const pequenos = cel
        ? [...document.querySelectorAll('button, a[href]')].filter((el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && st.visibility !== 'hidden' && (r.width < 43.5 || r.height < 43.5); }).map((el) => (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 24))
        : [];
      return { horizontal, pequenos };
    }, celular);
    const m1 = await medir();
    await p.screenshot({ path: path.join(SAIDA, `portao18b_eras_${nome}.png`) });
    // Modal de Ascensão (fecha com Voltar).
    const ascender = p.getByRole('button', { name: 'Ascender de era' }).first();
    await ascender.scrollIntoViewIfNeeded();
    await ascender.click();
    const modal = p.locator('[role="dialog"]').first();
    await modal.waitFor({ timeout: 10000 });
    await p.waitForTimeout(600);
    const textoModal = (await modal.innerText()).replace(/\s+/g, ' ');
    const modalOk = textoModal.includes(`Ao ascender: Falha ${FALHA} → ${FALHA + 1}`) && textoModal.includes('Obras e pesquisas 12% mais lentas') && textoModal.includes('A cada recomeço, o Relógio falha mais.');
    const m2 = await medir();
    await p.screenshot({ path: path.join(SAIDA, `portao18b_ascensao_${nome}.png`) });
    await modal.getByRole('button', { name: 'Voltar' }).click();
    const ok = etiqueta && efeitos && lore && semCripta && modalOk && m1.horizontal <= 0 && m2.horizontal <= 0 && m1.pequenos.length === 0 && m2.pequenos.length === 0;
    if (!ok) falhas++;
    console.log(`${nome.padStart(4)} px  etiqueta ${etiqueta ? 'sim' : 'não'}  próximo nível ${efeitos ? 'sim' : 'não'}  lore ${lore ? 'sim' : 'não'}  sem Cripta ${semCripta ? 'sim' : 'não'}  modal ${modalOk ? 'sim' : 'não'}  rolagem horizontal ${Math.max(m1.horizontal, m2.horizontal) > 0 ? 'sim' : 'não'}  alvos < 44: ${[...m1.pequenos, ...m2.pequenos].join('; ') || 'nenhum'}  ${ok ? 'ok' : 'FALHOU'}`);
    await c.close();
  }
  await b.close();
  if (falhas) process.exit(1);
  console.log('tudo ok; capturas em docs/referencia/portao18b_*.png');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
