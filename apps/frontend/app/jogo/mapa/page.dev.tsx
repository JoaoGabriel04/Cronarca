// Preview do mapa grande (Portão 7c). Só existe no servidor de
// desenvolvimento: arquivos .dev.tsx nem entram no build de produção
// (next.config.ts, pageExtensions). ?pesquisas=cartografia,estradas_reais
// abre o estado de exemplo com essas pesquisas concluídas (pins e névoa);
// ?exemplo=0 começa do início do ciclo, sem a expedição e a obra de exemplo.
import { PESQUISAS_IDS, type PesquisaId } from '@cronarca/game-core';
import { MapaDePreview } from '../../../components/jogo/MapaDePreview';
import { ProvedorAvisos } from '../../../lib/jogo/avisos';

export const metadata = { title: 'Preview do mapa' };

function lerPesquisas(valor: string | string[] | undefined): PesquisaId[] {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  if (!texto) return [];
  return texto.split(',').filter((p): p is PesquisaId => (PESQUISAS_IDS as readonly string[]).includes(p));
}

export default async function PreviewMapa({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pesquisas = lerPesquisas(params.pesquisas);
  const exemplo = params.exemplo !== '0';
  return (
    <ProvedorAvisos>
      <main>
        <MapaDePreview key={`${pesquisas.join(',')}:${exemplo}`} pesquisas={pesquisas} exemplo={exemplo} />
      </main>
    </ProvedorAvisos>
  );
}
