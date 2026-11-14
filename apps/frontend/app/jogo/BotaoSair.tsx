'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import { enviar } from '../../lib/api';
import { CHAVE_USUARIO, useUsuario } from '../../lib/usuario';

// Provisório até o modal de Configurações (Portão 13). Também confirma a sessão.
export function BotaoSair({ className = 'caixa botao' }: { className?: string }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { usuario } = useUsuario();
  const [saindo, setSaindo] = useState(false);

  // O proxy do Next só olha se o cookie existe; quem confirma a sessão é o servidor.
  useEffect(() => {
    if (usuario === null) router.replace('/login?voltar=/jogo');
  }, [usuario, router]);

  async function sair() {
    setSaindo(true);
    try {
      await enviar('/api/auth/logout');
    } finally {
      await mutate(CHAVE_USUARIO, null, { revalidate: false });
      router.replace('/');
    }
  }

  return (
    <button type="button" className={className} onClick={sair} disabled={saindo || !usuario}>
      {saindo ? 'Saindo…' : 'Sair'}
    </button>
  );
}
