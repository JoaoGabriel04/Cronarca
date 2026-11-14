import { JogoAoVivo } from '../../components/jogo/JogoAoVivo';
import { ProvedorAvisos } from '../../lib/jogo/avisos';

export const metadata = { title: 'Seu reino' };

// O jogo de verdade mostra sempre o estado do jogador, lido do servidor
// (Portão 10). Só em desenvolvimento, com NEXT_PUBLIC_DEBUG_MAPA=1, o mapa
// liga as teclas de depuração e o rodapé ganha o link do preview do mapa
// (/jogo/mapa). A condição fica escrita aqui (e não importada) para o build
// de produção trocá-la por false e jogar fora o import das peças de depuração.
export default async function Jogo() {
  const depuracao = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEBUG_MAPA === '1' ? await import('./depuracao') : null;
  return (
    <ProvedorAvisos>
      <JogoAoVivo depuracao={depuracao !== null} acoesDepuracao={depuracao && <depuracao.LinkPreviewMapa />} />
    </ProvedorAvisos>
  );
}
