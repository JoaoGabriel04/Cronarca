'use client';

// Objetivo sempre à vista, Diário e prólogo (Portão 16). O texto do objetivo
// vem de proximoPasso (game-core), a lore de data/lore.ts: aqui só a casca.
// Ícones só do Lucide; o selo do relógio no prólogo (marca, pixel inteiro).

import { PROLOGO, type CapituloId, type ProximoPasso } from '@cronarca/game-core';
import { BookOpen, ChevronRight, Target } from 'lucide-react';
import { useState } from 'react';
import type { LinhaDiario } from '../../lib/casca/diario';
import { MARCA } from '../../lib/marca';
import estilosCasca from './casca.module.css';
import { Modal } from './Modal';
import estilos from './modais.module.css';

/** Chip "Objetivo" (desktop, na linha das abas): o passo principal; toque abre o painel com as trilhas. */
export function ChipObjetivo({ texto, aoAbrir }: { texto: string; aoAbrir: () => void }) {
  return (
    <button type="button" className={`caixa ${estilosCasca.chipObjetivo}`} onClick={aoAbrir} title={texto} aria-label={`Objetivo: ${texto}. Abrir os objetivos`}>
      <Target size={18} strokeWidth={2.5} aria-hidden="true" />
      <span className={estilosCasca.chipObjetivoRotulo}>Objetivo</span>
      <span className={estilosCasca.chipObjetivoTexto}>{texto}</span>
    </button>
  );
}

/** Abaixo de 1024 px: faixa fina sob os recursos, com o objetivo e o botão Diário (44 px). */
export function FaixaObjetivo({ texto, novos, aoAbrir, aoDiario }: { texto: string; novos: number; aoAbrir: () => void; aoDiario: () => void }) {
  return (
    <div className={estilosCasca.faixaObjetivo}>
      <ChipObjetivo texto={texto} aoAbrir={aoAbrir} />
      <BotaoDiario novos={novos} aoAbrir={aoDiario} />
    </div>
  );
}

/** Botão Diário (HUD no desktop, faixa no celular), com o ponto quando há página nova. */
export function BotaoDiario({ novos, aoAbrir, classe = '' }: { novos: number; aoAbrir: () => void; classe?: string }) {
  return (
    <span className={`${estilosCasca.comSelo} ${classe}`}>
      <button
        type="button"
        className={`caixa ${estilosCasca.botaoHud}`}
        onClick={aoAbrir}
        aria-label={novos > 0 ? `Diário (${novos} página${novos === 1 ? '' : 's'} nova${novos === 1 ? '' : 's'})` : 'Diário'}
        title="Diário"
      >
        <BookOpen size={24} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {novos > 0 && <span className={estilosCasca.pontoNovo} aria-hidden="true" />}
    </span>
  );
}

/** Painel do objetivo: as três trilhas da Era I, com o passo e o motivo de cada, e a dica do Sábio. */
export function ModalObjetivo({ passo, aoEras, aoFechar }: { passo: ProximoPasso; aoEras: () => void; aoFechar: () => void }) {
  return (
    <Modal titulo="Objetivos da era" subtitulo={passo.principal} largura="estreita" aoFechar={aoFechar}>
      <ul className={estilos.trilhas}>
        {passo.trilhas.map((t) => (
          <li key={t.trilha} className={`caixa ${estilos.cartao} ${estilos.trilha} ${t.cumprida ? estilos.trilhaCumprida : ''}`}>
            <p className={estilos.trilhaTitulo}>
              <span className={estilosCasca.somenteLeitor}>{t.cumprida ? 'Cumprido: ' : 'Pendente: '}</span>
              {t.titulo}
            </p>
            {!t.cumprida && <p className={estilos.trilhaPasso}>{t.passo}</p>}
            {!t.cumprida && t.motivo && <p className={estilos.trilhaMotivo}>{t.motivo}</p>}
          </li>
        ))}
      </ul>
      {passo.sabio && <p className={estilos.sabio}>{passo.sabio}</p>}
      <button type="button" className={`caixa botao ${estilos.botao} ${estilos.botaoEras}`} onClick={aoEras}>
        Ver na tela de Eras
        <ChevronRight size={18} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </Modal>
  );
}

/** Diário: capítulos liberados (abrem o texto) e bloqueados ("?" e a dica neutra); reler o prólogo. */
export function ModalDiario({ linhas, aoAbrir, aoPrologo, aoFechar }: { linhas: LinhaDiario[]; aoAbrir: (id: CapituloId) => void; aoPrologo: () => void; aoFechar: () => void }) {
  const liberados = linhas.filter((l) => l.liberado).length;
  return (
    <Modal titulo="Diário" subtitulo={`${liberados} de ${linhas.length} páginas`} largura="estreita" aoFechar={aoFechar}>
      <ol className={estilos.diario}>
        {linhas.map((l) =>
          l.liberado ? (
            <li key={l.id}>
              <details className={`caixa ${estilos.cartao} ${estilos.capitulo}`} onToggle={(ev) => (ev.currentTarget as HTMLDetailsElement).open && aoAbrir(l.id)}>
                <summary className={estilos.capituloTitulo}>
                  {l.titulo}
                  {l.novo && <span className={estilos.novo}>novo</span>}
                </summary>
                <p className={estilos.capituloTexto}>{l.texto}</p>
              </details>
            </li>
          ) : (
            <li key={l.id} className={`caixa ${estilos.cartao} ${estilos.capitulo} ${estilos.capituloBloqueado}`}>
              <p className={estilos.capituloTitulo}>?</p>
              <p className={estilos.capituloDica}>{l.dica}</p>
            </li>
          ),
        )}
      </ol>
      <button type="button" className={`caixa botao ${estilos.botao} ${estilos.botaoEras}`} onClick={aoPrologo}>
        Reler o prólogo
      </button>
    </Modal>
  );
}

/** Prólogo: 3 cartões com o selo do relógio no topo; Continuar e Pular (44 px). */
export function ModalPrologo({ aoFechar }: { aoFechar: () => void }) {
  const [i, setI] = useState(0);
  const ultimo = i === PROLOGO.length - 1;
  return (
    <Modal titulo="O Relógio parado" subtitulo={`${i + 1} de ${PROLOGO.length}`} largura="estreita" aoFechar={aoFechar}>
      <div className={estilos.prologo}>
        <img className={estilos.seloPrologo} src={MARCA.selo(64)} alt="" width={64} height={64} draggable={false} />
        <p className={estilos.prologoTexto}>{PROLOGO[i]}</p>
      </div>
      <div className={estilos.prologoBotoes}>
        <button type="button" className={`caixa botao ${estilos.botao}`} onClick={aoFechar}>
          Pular
        </button>
        <button type="button" className={`caixa botao botao-dourado ${estilos.botao}`} onClick={() => (ultimo ? aoFechar() : setI(i + 1))}>
          {ultimo ? 'Começar' : 'Continuar'}
        </button>
      </div>
    </Modal>
  );
}
