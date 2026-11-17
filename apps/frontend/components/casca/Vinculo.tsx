'use client';

// Vínculo da conta de convidado (Portão B), no Modal do jogo: e-mail e senha, Google ou Discord, e a escolha do
// nome que vai ao ranking. Nunca mescla contas: se o e-mail ou a conta já são de outro reino, o jogador escolhe
// entre entrar nessa conta (e perder o convidado) ou cancelar.

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { useSWRConfig } from 'swr';
import { enviar, ErroApi, mensagemDeErro, type UsuarioPublico } from '../../lib/api';
import { limparCacheDoJogo } from '../../lib/jogo/cache';
import { nomeParaConfirmar, type RetornoVinculo } from '../../lib/convidado';
import { CHAVE_USUARIO, estadoProvedor, useProvedores } from '../../lib/usuario';
import { Modal } from './Modal';
import estilos from './modais.module.css';

type Passo = 'escolher' | 'nome' | 'conflito';

export function ModalVinculo({
  usuario,
  retorno,
  aoConcluir,
  aoFechar,
}: {
  usuario: UsuarioPublico;
  retorno: RetornoVinculo | null;
  aoConcluir: () => void;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { dados: provedores, desistiu } = useProvedores();
  const idNome = useId();
  const idEmail = useId();
  const idSenha = useId();

  const [passo, setPasso] = useState<Passo>(() =>
    retorno?.passo === 'erro' && retorno.codigo === 'conta_ja_vinculada' ? 'conflito' : retorno?.passo === 'nome' || usuario.vinculoPendente ? 'nome' : 'escolher',
  );
  const [aviso, setAviso] = useState<string | null>(() => (retorno?.passo === 'erro' && retorno.codigo !== 'conta_ja_vinculada' ? mensagemDeErro(retorno.codigo) : null));
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [nome, setNome] = useState(() => nomeParaConfirmar(retorno?.passo === 'nome' ? retorno.nome : '', usuario.email));
  const [valores, setValores] = useState({ nome: '', email: '', senha: '' });

  async function concluir(corpo: { usuario: UsuarioPublico } | null) {
    await mutate(CHAVE_USUARIO, corpo?.usuario ?? null, { revalidate: false });
    aoConcluir();
  }

  async function enviarCom(caminho: string, corpo: unknown) {
    setEnviando(true);
    setAviso(null);
    setCampos({});
    try {
      await concluir(await enviar<{ usuario: UsuarioPublico }>(caminho, corpo));
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'conta_ja_vinculada') setPasso('conflito');
      else if (e instanceof ErroApi) {
        setCampos(e.campos);
        setAviso(mensagemDeErro(e.codigo));
      } else setAviso('Sem conexão com o servidor. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  function aoEnviarEmail(ev: FormEvent) {
    ev.preventDefault();
    void enviarCom('/api/auth/vincular/email', valores);
  }

  function aoConfirmarNome(ev: FormEvent) {
    ev.preventDefault();
    void enviarCom('/api/auth/vincular/confirmar', { nome });
  }

  async function entrarNaContaExistente() {
    setEnviando(true);
    try {
      await enviar('/api/auth/logout');
    } finally {
      await limparCacheDoJogo(mutate);
      await mutate(CHAVE_USUARIO, null, { revalidate: false });
      router.replace('/login');
    }
  }

  const erroCampo = (c: string) => campos[c] && <p className="campo-erro">{campos[c]}</p>;
  const aviso_ = aviso && (
    <p className="aviso-erro" role="alert">
      {aviso}
    </p>
  );

  if (passo === 'conflito') {
    return (
      <Modal titulo="Conta já existente" subtitulo="Este e-mail ou esta conta já pertence a outro reino." largura="estreita" aoFechar={aoFechar}>
        <p className={estilos.texto}>
          Para não misturar reinos, nada foi mesclado. Você pode entrar na conta existente (o progresso deste convidado se perde) ou cancelar e continuar como convidado.
        </p>
        <div className={estilos.acoesLinha}>
          <button type="button" className={`caixa botao ${estilos.botaoPequeno}`} onClick={() => setPasso('escolher')} disabled={enviando}>
            Cancelar
          </button>
          <button type="button" className={`caixa botao botao-dourado ${estilos.botaoPequeno}`} onClick={() => void entrarNaContaExistente()} disabled={enviando}>
            Entrar na conta existente
          </button>
        </div>
      </Modal>
    );
  }

  if (passo === 'nome') {
    return (
      <Modal titulo="Nome no ranking" subtitulo="Como o reino vai te chamar nas listas." largura="estreita" aoFechar={aoFechar}>
        <form onSubmit={aoConfirmarNome} className={estilos.formVinculo} noValidate>
          {aviso_}
          <label className="campo-rotulo" htmlFor={idNome}>Nome do soberano</label>
          <input id={idNome} className="caixa campo" value={nome} maxLength={32} autoComplete="nickname" required onChange={(e) => setNome(e.target.value)} />
          {erroCampo('nome')}
          <button type="submit" className={`caixa botao botao-dourado ${estilos.botaoPequeno}`} disabled={enviando}>
            {enviando ? 'Aguarde…' : 'Confirmar'}
          </button>
        </form>
      </Modal>
    );
  }

  return (
    <Modal titulo="Vincular conta" subtitulo="Guarde seu reino e entre no ranking dos reinos." largura="estreita" aoFechar={aoFechar}>
      <form onSubmit={aoEnviarEmail} className={estilos.formVinculo} noValidate>
        {aviso_}
        <label className="campo-rotulo" htmlFor={idNome}>Nome do soberano</label>
        <input id={idNome} className="caixa campo" value={valores.nome} maxLength={32} autoComplete="nickname" required onChange={(e) => setValores({ ...valores, nome: e.target.value })} />
        {erroCampo('nome')}
        <label className="campo-rotulo" htmlFor={idEmail}>E-mail</label>
        <input id={idEmail} type="email" className="caixa campo" value={valores.email} autoComplete="email" required onChange={(e) => setValores({ ...valores, email: e.target.value })} />
        {erroCampo('email')}
        <label className="campo-rotulo" htmlFor={idSenha}>Senha</label>
        <input id={idSenha} type="password" className="caixa campo" value={valores.senha} autoComplete="new-password" placeholder="Pelo menos 8 caracteres" required onChange={(e) => setValores({ ...valores, senha: e.target.value })} />
        {erroCampo('senha')}
        <button type="submit" className={`caixa botao botao-dourado ${estilos.botaoPequeno}`} disabled={enviando}>
          {enviando ? 'Aguarde…' : 'Vincular com e-mail'}
        </button>
      </form>
      <p className={estilos.dica}>ou ligue uma conta do provedor (você escolhe o nome em seguida)</p>
      <div className={estilos.acoesLinha}>
        {(['google', 'discord'] as const).map((p) => {
          const nomeP = p === 'google' ? 'Google' : 'Discord';
          return estadoProvedor(provedores, desistiu, p) === 'ligado' ? (
            // Navegação de página inteira: o backend guarda a intenção no cookie e redireciona ao provedor.
            <a key={p} className={`caixa botao botao-claro ${estilos.botaoPequeno}`} href={`/api/auth/${p}/vincular`}>
              {nomeP}
            </a>
          ) : (
            <button key={p} type="button" className={`caixa botao ${estilos.botaoPequeno}`} disabled title={`${nomeP}: indisponível no momento`}>
              {nomeP}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
