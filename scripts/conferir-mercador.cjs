// Conferência da negociação com o Mercador no Chromium (desktop e celular).
// Roda dentro da imagem do Playwright (ver `make conferir-mercador`, que antes
// chama `make evento-mercador` para o Mercador estar pendente na conta dev).
//
// Em 1440, 601, 600, 390 e 360 px de largura, abre o popup do Mercador e confere:
// - "Você recebe" e "Você paga" com as quantidades e recursos que o SERVIDOR
//   gravou no evento (lidos de /api/game/state, não de constante);
// - botões "Aceitar troca" e "Recusar" visíveis, sem texto cortado;
// - prazo e a nota do que acontece ao recusar, visíveis sem rolar o popup.
// Grava as capturas em docs/referencia/mercador/depois_<largura>.png.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const APP = process.env.APP_URL || 'http://localhost:3000';
const SAIDA = path.resolve(__dirname, '..', 'docs/referencia/mercador');
const LARGURAS = [1440, 601, 600, 390, 360];
const NOMES = { madeira: 'madeira', pedra: 'pedra', comida: 'comida', ferro: 'ferro', ouro: 'ouro', saber: 'saber' };
const inteiro = (micro) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.floor(micro / 1_000_000));
const textos = (troca) => Object.entries(troca).filter(([, v]) => v > 0).map(([r, v]) => `${inteiro(v)} ${NOMES[r]}`);

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const navegador = await chromium.launch();
  const sessao = await navegador.newContext();
  const login = await sessao.request.post(`${APP}/api/auth/login`, { headers: { Origin: APP }, data: { email: 'dev@cronarca.local', senha: 'cronarca' } });
  if (!login.ok()) throw new Error(`login falhou (${login.status()}): rode \`make seed\``);
  const corpo = await (await sessao.request.get(`${APP}/api/game/state`)).json();
  const m = corpo.estado.mercador;
  if (!m) throw new Error('Sem Mercador pendente: rode `make evento-mercador` (prazo de 2 min).');
  const esperado = { recebe: textos(m.recebe), paga: textos(m.paga) };
  const estado = await sessao.storageState();
  let falhas = 0;

  for (const largura of LARGURAS) {
    const toque = largura <= 600;
    const ctx = await navegador.newContext({ viewport: { width: largura, height: largura > 1024 ? 900 : 844 }, hasTouch: toque, isMobile: toque, storageState: estado });
    const p = await ctx.newPage();
    await p.goto(`${APP}/jogo`, { timeout: 120_000 });
    const chip = p.locator('button[aria-label^="Mercador Viajante"]');
    const popup = p.locator('section[aria-labelledby="titulo-evento"]');
    await Promise.race([chip.waitFor({ timeout: 120_000 }), popup.waitFor({ timeout: 120_000 })]);
    await p.waitForTimeout(800);
    if (!(await popup.isVisible())) {
      await chip.click();
      await popup.waitFor();
    }
    await p.waitForTimeout(600);

    const r = await popup.evaluate((el) => {
      const visivel = (n) => {
        if (!n) return false;
        const a = n.getBoundingClientRect();
        const c = el.getBoundingClientRect();
        return a.width > 0 && a.height > 0 && a.top >= c.top - 1 && a.bottom <= c.bottom + 1 && getComputedStyle(n).visibility !== 'hidden';
      };
      const linha = (rotulo) => [...el.querySelectorAll('dl > div')].find((d) => d.querySelector('dt')?.textContent === rotulo);
      const itens = (rotulo) => [...(linha(rotulo)?.querySelectorAll('dd > span') ?? [])].map((s) => s.textContent.replace(/\s+/g, ' ').replace(/ \(você tem .*\)$/, '').trim());
      const botao = (nome) => [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === nome);
      const cortado = (b) => !b || b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().height > 60;
      const nota = [...el.querySelectorAll('p')].find((x) => /segue viagem/.test(x.textContent));
      return {
        recebe: itens('Você recebe'), paga: itens('Você paga'),
        recebeVisivel: visivel(linha('Você recebe')), pagaVisivel: visivel(linha('Você paga')),
        aceitar: visivel(botao('Aceitar troca')) && !cortado(botao('Aceitar troca')),
        recusar: visivel(botao('Recusar')) && !cortado(botao('Recusar')),
        prazo: visivel(el.querySelector('[aria-label^="Tempo restante"]')),
        nota: visivel(nota),
        rolagem: el.scrollHeight > el.clientHeight + 1,
      };
    });

    const erros = [];
    if (JSON.stringify(r.recebe) !== JSON.stringify(esperado.recebe)) erros.push(`recebe ${JSON.stringify(r.recebe)} != ${JSON.stringify(esperado.recebe)}`);
    if (JSON.stringify(r.paga) !== JSON.stringify(esperado.paga)) erros.push(`paga ${JSON.stringify(r.paga)} != ${JSON.stringify(esperado.paga)}`);
    for (const k of ['recebeVisivel', 'pagaVisivel', 'aceitar', 'recusar', 'prazo', 'nota']) if (!r[k]) erros.push(`${k} não visível ou cortado`);
    if (r.rolagem) erros.push('popup precisa rolar');
    await p.screenshot({ path: path.join(SAIDA, `depois_${largura}.png`) });
    console.log(`${String(largura).padStart(4)} px  recebe ${r.recebe.join(' + ')}  paga ${r.paga.join(' + ')}  ${erros.length ? 'FALHOU: ' + erros.join('; ') : 'ok'}`);
    falhas += erros.length;
    await ctx.close();
  }
  await navegador.close();
  if (falhas) process.exit(1);
  console.log(`tudo ok; capturas em docs/referencia/mercador/`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
