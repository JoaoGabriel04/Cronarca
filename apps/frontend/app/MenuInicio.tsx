'use client';

import { Settings } from 'lucide-react';
import Link from 'next/link';
import { useUsuario } from '../lib/usuario';
import estilos from './inicio.module.css';

/**
 * Menu da tela inicial. Sem sessão, os botões levam ao login (ou ao
 * cadastro); com sessão, "Ranking dos Reinos" abre o jogo com o modal do
 * ranking (Portão 15), que só é lido logado.
 */
export function MenuInicio() {
  const { usuario, carregando } = useUsuario();
  const logado = Boolean(usuario);

  return (
    <>
      <nav className={`caixa caixa-madeira com-linha ${estilos.menu}`} aria-label="Menu principal">
        <Link
          href={logado ? '/jogo' : '/login'}
          className="caixa botao botao-dourado"
          aria-disabled={carregando || undefined}
        >
          Continuar Crônica
        </Link>
        {logado ? (
          <button type="button" className="caixa botao" disabled title="Disponível em breve">
            Nova Crônica
          </button>
        ) : (
          <Link href="/login?modo=cadastro" className="caixa botao">
            Nova Crônica
          </Link>
        )}
        <Link href={logado ? '/jogo?ranking=1' : '/login'} className="caixa botao" aria-disabled={carregando || undefined}>
          Ranking dos Reinos
        </Link>
        <p className={estilos.versao}>Era I · Aldeia &nbsp; · &nbsp; v0.1</p>
      </nav>
      <button
        type="button"
        className={`caixa botao botao-icone ${estilos.config}`}
        disabled
        title="Configurações (disponível em breve)"
        aria-label="Configurações"
      >
        <img src="/sprites/icone-config.svg" alt="" width={32} height={32} />
        {/* No celular a placa do desktop vira este botão no canto, com o ícone do Lucide. */}
        <Settings className={estilos.iconeCelular} size={24} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </>
  );
}
