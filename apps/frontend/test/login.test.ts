import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AVISO_CONVIDADO, LEGENDA_CONVIDADO, lerRetornoVinculo, nomeParaConfirmar, semParametrosDeVinculo } from '../lib/convidado';

const RAIZ = join(__dirname, '..');
const ler = (f: string) => readFileSync(join(RAIZ, f), 'utf8');

function fontes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const c = join(dir, n);
    if (n === 'node_modules' || n === '.next' || n === 'test') return [];
    return statSync(c).isDirectory() ? fontes(c) : /\.(tsx?|css)$/.test(n) ? [c] : [];
  });
}

describe('login: esqueci a senha e convidado (Portão A)', () => {
  it('nenhum arquivo do front fala de "Esqueci a senha" ou recuperação de senha', () => {
    for (const f of [...fontes(join(RAIZ, 'app')), ...fontes(join(RAIZ, 'components')), ...fontes(join(RAIZ, 'lib'))]) {
      const t = readFileSync(f, 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
      expect(t, f).not.toMatch(/esqueci|recuperar senha|redefinir senha|forgot/i);
    }
  });
  it('o texto antigo do convidado ("só neste navegador") não existe mais', () => {
    expect(ler('app/login/CartaoLogin.tsx')).not.toMatch(/neste navegador/);
    expect(LEGENDA_CONVIDADO).not.toMatch(/neste navegador|ranking n[ãa]o conta/);
  });
  it('a legenda é a do dono, em duas frases', () => {
    expect(LEGENDA_CONVIDADO).toBe('Cria uma conta de convidado. Vincule um e-mail ou o Google depois para não perder o progresso.');
  });
  it('"Jogar sem conta" chama o servidor, que decide tudo: o cliente não envia nome nem estado', () => {
    const t = ler('app/login/CartaoLogin.tsx');
    expect(t).toMatch(/Jogar sem conta/);
    expect(t).toMatch(/enviar<\{ usuario: UsuarioPublico \}>\('\/api\/auth\/convidado', \{\}\)/);
    expect(t).toMatch(/aria-describedby="legenda-convidado"/);
    expect(t).not.toMatch(/CONVIDADO_DISPONIVEL/);
  });
  it('o aviso do jogo e a legenda do login não se confundem e não usam emoji', () => {
    expect(AVISO_CONVIDADO).toBe('Conta de convidado: vincule para guardar seu reino e entrar no ranking.');
    expect(AVISO_CONVIDADO).not.toBe(LEGENDA_CONVIDADO);
    expect(`${AVISO_CONVIDADO}${LEGENDA_CONVIDADO}`).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it('no mobile o cartão não tem selo nem pergaminho, e o formulário tem 350 de largura', () => {
    const css = ler('app/login/login.module.css');
    const mobile = css.slice(css.indexOf('@media (max-width: 899px)'));
    expect(mobile).toMatch(/width: min\(100%, 350px\)/);
    expect(mobile).toMatch(/\.selo,\s*\.sub \{\s*display: none/);
    expect(mobile).toMatch(/clip-path: none/);
    expect(mobile).toMatch(/\.formulario :global\(\.campo\) \{\s*height: 44px/);
    expect(mobile).toMatch(/\.principal \{\s*height: 50px/);
    expect(mobile).toMatch(/min-height: 46px/);
    expect(mobile).toMatch(/width: 300px/);
  });
});

describe('vínculo do convidado: retorno do provedor', () => {
  it('lê o passo do nome (com a sugestão) e o erro, e ignora o resto', () => {
    expect(lerRetornoVinculo(new URLSearchParams('vinculo=nome&nome=Brenna%20Google'))).toEqual({ passo: 'nome', nome: 'Brenna Google' });
    expect(lerRetornoVinculo(new URLSearchParams('vinculo=nome'))).toEqual({ passo: 'nome', nome: '' });
    expect(lerRetornoVinculo(new URLSearchParams('vinculo_erro=conta_ja_vinculada'))).toEqual({ passo: 'erro', codigo: 'conta_ja_vinculada' });
    expect(lerRetornoVinculo(new URLSearchParams('ranking=1'))).toBeNull();
    expect(lerRetornoVinculo(new URLSearchParams(`vinculo=nome&nome=${'x'.repeat(80)}`))).toEqual({ passo: 'nome', nome: 'x'.repeat(32) });
  });
  it('limpa só os parâmetros do vínculo da URL', () => {
    expect(semParametrosDeVinculo(new URL('http://x/jogo?vinculo=nome&nome=Ana&outro=1#a'))).toBe('/jogo?outro=1#a');
    expect(semParametrosDeVinculo(new URL('http://x/jogo?vinculo_erro=oauth_falhou'))).toBe('/jogo');
  });
  it('o nome pré-preenchido é o do provedor, senão a parte do e-mail antes do @', () => {
    expect(nomeParaConfirmar('Brenna', 'b@x.com')).toBe('Brenna');
    expect(nomeParaConfirmar('', 'brenna.silva@gmail.com')).toBe('brenna.silva');
    expect(nomeParaConfirmar(null, null)).toBe('');
  });
});
