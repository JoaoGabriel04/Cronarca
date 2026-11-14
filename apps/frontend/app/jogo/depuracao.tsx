// Peças de depuração do /jogo. Só são importadas quando a depuração está
// ligada: em produção o build nem as inclui.
import Link from 'next/link';

/** Rodapé do jogo: abre o preview do mapa grande (/jogo/mapa). */
export function LinkPreviewMapa() {
  return (
    <Link href="/jogo/mapa" className="caixa botao botao-claro" prefetch={false}>
      Preview do mapa
    </Link>
  );
}
