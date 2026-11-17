'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useSWRConfig } from 'swr';
import { enviar, ErroApi, mensagemDeErro, type UsuarioPublico } from '../../lib/api';
import { LEGENDA_CONVIDADO } from '../../lib/convidado';
import { limparCacheDoJogo } from '../../lib/jogo/cache';
import { CHAVE_USUARIO, estadoProvedor, useProvedores, useUsuario, type EstadoProvedor } from '../../lib/usuario';
import estilos from './login.module.css';

type Modo = 'entrar' | 'cadastro';
type Campos = Partial<Record<'nome' | 'email' | 'senha' | 'confirmar', string>>;

/** Só aceita caminhos internos, para o "voltar" não virar redirecionamento aberto. */
function destinoSeguro(voltar: string | null): string {
  return voltar && voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/jogo';
}

export function CartaoLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const { mutate } = useSWRConfig();
  const { usuario } = useUsuario();
  const { dados: provedores, desistiu } = useProvedores();

  const [modo, setModo] = useState<Modo>(params.get('modo') === 'cadastro' ? 'cadastro' : 'entrar');
  const [valores, setValores] = useState({ nome: '', email: '', senha: '', confirmar: '' });
  const [erros, setErros] = useState<Campos>({});
  const [aviso, setAviso] = useState<string | null>(() => {
    const erro = params.get('erro');
    return erro ? mensagemDeErro(erro) : null;
  });
  const [enviando, setEnviando] = useState(false);
  const [criandoConvidado, setCriandoConvidado] = useState(false);
  const destino = destinoSeguro(params.get('voltar'));

  // Quem já tem sessão não precisa desta tela.
  useEffect(() => {
    if (usuario) router.replace(destino);
  }, [usuario, router, destino]);

  function trocarModo(novo: Modo) {
    setModo(novo);
    setErros({});
    setAviso(null);
  }

  function mudar(campo: keyof typeof valores, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function aoEnviar(ev: FormEvent) {
    ev.preventDefault();
    setAviso(null);
    if (modo === 'cadastro' && valores.senha !== valores.confirmar) {
      setErros({ confirmar: 'As senhas não são iguais.' });
      return;
    }
    setEnviando(true);
    try {
      const corpo =
        modo === 'cadastro'
          ? { nome: valores.nome, email: valores.email, senha: valores.senha }
          : { email: valores.email, senha: valores.senha };
      const res = await enviar<{ usuario: UsuarioPublico }>(
        modo === 'cadastro' ? '/api/auth/cadastro' : '/api/auth/login',
        corpo,
      );
      await limparCacheDoJogo(mutate);
      await mutate(CHAVE_USUARIO, res?.usuario ?? null, { revalidate: false });
      router.push(destino);
    } catch (e) {
      if (e instanceof ErroApi) {
        setErros(e.campos as Campos);
        setAviso(mensagemDeErro(e.codigo));
      } else {
        setAviso('Sem conexão com o servidor. Tente de novo.');
      }
      setValores((v) => ({ ...v, senha: '', confirmar: '' }));
    } finally {
      setEnviando(false);
    }
  }

  /** Conta de convidado: o servidor cria o usuário e abre a sessão (nada é enviado pelo cliente). */
  async function jogarSemConta() {
    setAviso(null);
    setCriandoConvidado(true);
    try {
      const res = await enviar<{ usuario: UsuarioPublico }>('/api/auth/convidado', {});
      await limparCacheDoJogo(mutate);
      await mutate(CHAVE_USUARIO, res?.usuario ?? null, { revalidate: false });
      router.push(destino);
    } catch (e) {
      setAviso(e instanceof ErroApi ? mensagemDeErro(e.codigo) : 'Sem conexão com o servidor. Tente de novo.');
      setCriandoConvidado(false);
    }
  }

  const cadastro = modo === 'cadastro';

  return (
    <section
      className={`caixa pergaminho com-linha ${estilos.cartao}${cadastro ? ` ${estilos.cartaoCadastro}` : ''}`}
      aria-labelledby="titulo-login"
    >
      <div className={`caixa selo ${estilos.selo}`} aria-hidden="true">
        <img src="/sprites/icone-saber.svg" alt="" width={64} height={64} draggable={false} />
      </div>
      <h1 id="titulo-login" className={estilos.titulo}>
        {cadastro ? 'Nova Crônica' : 'Entrar na Crônica'}
      </h1>
      <p className={estilos.sub}>
        {cadastro
          ? 'Crie sua conta para guardar seu reino e entrar no ranking.'
          : 'Seu reino fica guardado na sua conta e entra no ranking dos reinos.'}
      </p>

      <form className={estilos.formulario} onSubmit={aoEnviar} noValidate>
        {aviso && (
          <p className="aviso-erro" role="alert">
            {aviso}
          </p>
        )}
        {cadastro && (
          <Campo
            nome="nome"
            rotulo="Nome do soberano"
            valor={valores.nome}
            erro={erros.nome}
            aoMudar={(v) => mudar('nome', v)}
            autoComplete="nickname"
            placeholder="Como o reino vai te chamar"
            maxLength={32}
          />
        )}
        <Campo
          nome="email"
          rotulo="E-mail"
          tipo="email"
          valor={valores.email}
          erro={erros.email}
          aoMudar={(v) => mudar('email', v)}
          autoComplete="email"
          placeholder="voce@exemplo.com"
        />
        <Campo
          nome="senha"
          rotulo="Senha"
          tipo="password"
          valor={valores.senha}
          erro={erros.senha}
          aoMudar={(v) => mudar('senha', v)}
          autoComplete={cadastro ? 'new-password' : 'current-password'}
          placeholder={cadastro ? 'Pelo menos 8 caracteres' : '••••••••'}
        />
        {cadastro && (
          <Campo
            nome="confirmar"
            rotulo="Confirmar senha"
            tipo="password"
            valor={valores.confirmar}
            erro={erros.confirmar}
            aoMudar={(v) => mudar('confirmar', v)}
            autoComplete="new-password"
            placeholder="Repita a senha"
          />
        )}
        <button type="submit" className={`caixa botao botao-dourado ${estilos.principal}`} disabled={enviando}>
          {enviando ? 'Aguarde…' : cadastro ? 'Criar conta' : 'Entrar'}
        </button>
      </form>

      {!cadastro && (
        <>
          <div className={estilos.ou} aria-hidden="true">
            <span />
            ou
            <span />
          </div>
          <div className={estilos.provedores}>
            <BotaoProvedor provedor="google" nome="Google" estado={estadoProvedor(provedores, desistiu, 'google')} />
            <BotaoProvedor provedor="discord" nome="Discord" estado={estadoProvedor(provedores, desistiu, 'discord')} />
          </div>
          {provedores && !provedores.google && !provedores.discord && (
            <p className={estilos.nota}>Entrar com Google e Discord fica disponível em breve.</p>
          )}
        </>
      )}

      <p className={estilos.alternar}>
        {cadastro ? 'Já tem conta? ' : 'Primeira vez por aqui? '}
        <button type="button" className="link" onClick={() => trocarModo(cadastro ? 'entrar' : 'cadastro')}>
          {cadastro ? 'Entrar' : 'Criar nova conta'}
        </button>
      </p>

      {!cadastro && (
        <div className={estilos.convidado}>
          <button
            type="button"
            className={`caixa botao ${estilos.botaoConvidado}`}
            disabled={criandoConvidado || enviando}
            aria-describedby="legenda-convidado"
            onClick={() => void jogarSemConta()}
          >
            {criandoConvidado ? 'Aguarde…' : 'Jogar sem conta'}
          </button>
          <p id="legenda-convidado" className={estilos.legenda}>
            {LEGENDA_CONVIDADO}
          </p>
        </div>
      )}
    </section>
  );
}

function Campo(props: {
  nome: string;
  rotulo: string;
  valor: string;
  erro: string | undefined;
  aoMudar: (v: string) => void;
  tipo?: 'text' | 'email' | 'password';
  autoComplete: string;
  placeholder: string;
  maxLength?: number;
}) {
  const id = useId();
  const idErro = `${id}-erro`;
  return (
    <div className={estilos.campo}>
      <label className="campo-rotulo" htmlFor={id}>
        {props.rotulo}
      </label>
      <input
        id={id}
        name={props.nome}
        type={props.tipo ?? 'text'}
        className="caixa campo"
        value={props.valor}
        onChange={(e) => props.aoMudar(e.target.value)}
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        aria-invalid={props.erro ? true : undefined}
        aria-describedby={props.erro ? idErro : undefined}
        required
      />
      <p id={idErro} className="campo-erro">
        {props.erro ?? ''}
      </p>
    </div>
  );
}

function BotaoProvedor({ provedor, nome, estado }: { provedor: string; nome: string; estado: EstadoProvedor }) {
  if (estado === 'conectando') {
    // O servidor pode estar acordando (até ~1 min): não é "indisponível".
    return (
      <button type="button" className="caixa botao" disabled aria-busy="true" aria-label={`Entrar com ${nome}: conectando ao servidor`} title="Conectando ao servidor…">
        Conectando…
      </button>
    );
  }
  if (estado === 'indisponivel') {
    return (
      <button type="button" className="caixa botao" disabled title={`Entrar com ${nome}: indisponível no momento`}>
        {nome}
      </button>
    );
  }
  // Navegação de página inteira: o backend redireciona ao provedor.
  return (
    <a className="caixa botao botao-claro" href={`/api/auth/${provedor}/iniciar`}>
      Entrar com {nome}
    </a>
  );
}
