'use client';

// Painel lateral (Figma "Construcoes", "Destinos" e "Cronica"), num só bloco
// que rola por dentro: cabeçalho fixo no topo, os cartões e, embaixo, a
// Crônica. Os botões só emitem intenções tipadas: os modais de Melhorar e de
// expedição chegam nos Portões 12 e 13.

import type { DestinoId, OficioAldeao, PoliticaAldeoes, SlotId } from '@cronarca/game-core';
import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CartaConstrucao, CartaDestino, DadosAldeoes, LinhaCronica } from '../../lib/casca/dados';
import { AJUDA } from '../../lib/casca/ajuda';
import { SpriteAnimado } from '../anim/SpriteAnimado';
import { Ajuda } from './Ajuda';
import estilos from './casca.module.css';
import { Icone } from './Icone';

export type EventoCasca =
  | { tipo: 'melhorarClicado'; slot: SlotId }
  | { tipo: 'enviarClicado'; destino: DestinoId }
  | { tipo: 'verClicado'; destino: DestinoId }
  /** "+" (do Ocioso para o ofício) ou "−" (do ofício para o Ocioso), um aldeão por toque. */
  | { tipo: 'alocarAldeao'; de: OficioAldeao; para: OficioAldeao }
  | { tipo: 'configurarAldeoes'; automatica: boolean; politica: PoliticaAldeoes };

function CartaoConstrucao({ c, aoEvento }: { c: CartaConstrucao; aoEvento: (e: EventoCasca) => void }) {
  return (
    <li className={`caixa ${estilos.cartao}`}>
      <div className={`caixa ${estilos.miniatura}`}>
        <SpriteAnimado className={estilos.pixel} sprite={c.sprite} instancia={c.slot} lado={96} />
      </div>
      <div className={estilos.cartaoInfo}>
        <h3 className={estilos.cartaoNome}>
          {c.nome}
          <span className={estilos.nivel}>Nv {c.nivel}</span>
        </h3>
        <p className={`${estilos.cartaoTexto} ${c.situacao === 'obra' ? estilos.alerta : ''}`}>
          {c.situacao === 'obra' ? `Em obra · ${c.restante}` : c.efeito}
        </p>
        {c.custo.length > 0 && (
          <p className={estilos.custos} aria-label="Custo do próximo nível">
            {c.custo.map((k) => (
              <span key={k.recurso}>
                <Icone nome={`icone-${k.recurso}`} tamanho={16} />
                {k.valor}
              </span>
            ))}
          </p>
        )}
      </div>
      {c.situacao === 'pronta' ? (
        <button type="button" className={`caixa botao botao-dourado ${estilos.botaoCasca} ${estilos.acaoCartao}`} onClick={() => aoEvento({ tipo: 'melhorarClicado', slot: c.slot })}>
          Melhorar
        </button>
      ) : (
        <button type="button" className={`caixa botao ${estilos.botaoCasca} ${estilos.acaoCartao}`} disabled>
          {c.situacao === 'obra' ? 'Em obra' : 'Máximo'}
        </button>
      )}
    </li>
  );
}

export function CartaoDestino({ c, aoEvento }: { c: CartaDestino; aoEvento: (e: EventoCasca) => void }) {
  return (
    <li className={`caixa ${estilos.cartao} ${estilos.destino}`}>
      <div className={`caixa ${estilos.miniatura}`}>
        <SpriteAnimado className={estilos.pixel} sprite={{ grupo: 'expedicao', id: c.destino }} lado={64} />
        {c.nevoa && <span className={estilos.nevoa} />}
      </div>
      <div className={estilos.cartaoInfo}>
        <h3 className={estilos.cartaoNome}>{c.nome}</h3>
        <p className={`${estilos.cartaoTexto} ${c.emAndamento ? estilos.alerta : ''}`}>{c.linha}</p>
        <p className={estilos.custos} aria-label="Saque">
          {c.saque.map((r) => (
            <span key={r}>
              <Icone nome={`icone-${r}`} tamanho={16} />
            </span>
          ))}
        </p>
      </div>
      {c.botao === 'enviar' && (
        <button type="button" className={`caixa botao botao-dourado ${estilos.botaoCasca} ${estilos.acaoCartao}`} onClick={() => aoEvento({ tipo: 'enviarClicado', destino: c.destino })}>
          Enviar
        </button>
      )}
      {c.botao === 'ver' && (
        <button type="button" className={`caixa botao botao-claro ${estilos.botaoCasca} ${estilos.acaoCartao}`} onClick={() => aoEvento({ tipo: 'verClicado', destino: c.destino })}>
          Ver
        </button>
      )}
      {c.botao === 'bloqueada' && (
        // Mesmo visual claro do Figma, sem ação.
        <span className={`caixa botao botao-claro ${estilos.botaoCasca} ${estilos.acaoCartao}`} style={{ cursor: 'default' }} aria-disabled="true">
          Bloqueada
        </span>
      )}
    </li>
  );
}

/**
 * Aldeões da vila: quantos há e cabem, quando chega o próximo, o que cada
 * ofício faz agora e a distribuição (Portão 17). "+" tira um do Ocioso,
 * "−" manda um para o Ocioso; quem muda leva alguns segundos a caminho.
 */
export function CartaoAldeoes({ d, aoEvento }: { d: DadosAldeoes; aoEvento: (e: EventoCasca) => void }) {
  return (
    <section className={`caixa ${estilos.cartao} ${estilos.aldeoes}`} aria-labelledby="titulo-aldeoes">
      <h3 id="titulo-aldeoes" className={estilos.cartaoNome}>
        <Icone nome="icone-aldeao" tamanho={16} />
        Aldeões
        <span className={estilos.nivel}>
          {d.total} de {d.maximo}
        </span>
      </h3>
      <Ajuda rotulo={AJUDA.aldeoes.rotulo} texto={AJUDA.aldeoes.texto} />
      <p className={estilos.cartaoTexto}>Chegam um a cada 20 s, enquanto houver vaga nas Casas e comida.</p>
      <p className={`${estilos.cartaoTexto} ${d.alerta ? estilos.alerta : ''}`}>{d.situacao}</p>
      <ul className={estilos.oficios} aria-label="Ofícios">
        {d.oficios.map((o) => (
          <li key={o.oficio} className={o.parado ? estilos.oficioParado : undefined}>
            <span className={estilos.oficioInfo}>
              <span className={estilos.oficioNome}>{o.nome}</span>
              <span className={estilos.oficioEfeito}>
                {o.efeito}
                {o.aCaminho > 0 && <span className={estilos.aCaminho}> · {o.aCaminho} a caminho</span>}
              </span>
            </span>
            <span className={estilos.oficioAjuste}>
              {o.oficio !== 'ocioso' && (
                <button
                  type="button"
                  className={`caixa ${estilos.botaoOficio}`}
                  aria-label={`${o.nome}: menos um (vai para Ocioso)`}
                  disabled={!o.podeMenos}
                  onClick={() => aoEvento({ tipo: 'alocarAldeao', de: o.oficio, para: 'ocioso' })}
                >
                  <Minus size={16} strokeWidth={3} />
                </button>
              )}
              <span className={estilos.oficioQuantidade} aria-label={`${o.quantidade} ${o.nome}`}>
                {o.quantidade}
              </span>
              {o.oficio !== 'ocioso' && (
                <button
                  type="button"
                  className={`caixa ${estilos.botaoOficio}`}
                  aria-label={`${o.nome}: mais um (sai do Ocioso)`}
                  disabled={!o.podeMais}
                  onClick={() => aoEvento({ tipo: 'alocarAldeao', de: 'ocioso', para: o.oficio })}
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className={estilos.distribuicao}>
        <button
          type="button"
          role="switch"
          aria-checked={d.automatica}
          className={estilos.automatica}
          onClick={() => aoEvento({ tipo: 'configurarAldeoes', automatica: !d.automatica, politica: d.politica })}
        >
          <span>Automática</span>
          <span className={`caixa ${estilos.chave} ${d.automatica ? estilos.chaveLigada : ''}`} aria-hidden>
            <span />
          </span>
        </button>
        <label className={estilos.politica}>
          <span>Novos aldeões</span>
          <select
            className="caixa"
            value={d.politica}
            disabled={!d.automatica}
            onChange={(ev) => aoEvento({ tipo: 'configurarAldeoes', automatica: d.automatica, politica: ev.target.value as PoliticaAldeoes })}
          >
            {d.politicas.map((p) => (
              <option key={p.politica} value={p.politica} disabled={!p.escolhivel}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {d.aviso && <p className={`${estilos.cartaoTexto} ${estilos.avisoOciosos}`}>{d.aviso}</p>}
    </section>
  );
}

export interface PropsPainelLateral {
  titulo: string;
  subtitulo: string;
  icone: string;
  construcoes?: CartaConstrucao[];
  destinos?: CartaDestino[];
  /** Cartão dos aldeões, no topo (painel da Vila). */
  aldeoes?: DadosAldeoes;
  cronica: LinhaCronica[];
  aoEvento: (e: EventoCasca) => void;
  /** No fim da rolagem: as ações de depuração (o "Sair" foi para as Configurações). */
  rodape?: ReactNode;
}

export function PainelLateral({ titulo, subtitulo, icone, construcoes, destinos, aldeoes, cronica, aoEvento, rodape }: PropsPainelLateral) {
  return (
    <section className={`caixa pergaminho com-linha ${estilos.painel}`} aria-label={titulo}>
      <div className={`${estilos.rolagem} ${estilos.rola}`}>
        <header className={estilos.cabecalho}>
          <h2>{titulo}</h2>
          <p>{subtitulo}</p>
          <Icone nome={icone} />
        </header>
        {aldeoes && <CartaoAldeoes d={aldeoes} aoEvento={aoEvento} />}
        <ul className={estilos.lista}>
          {construcoes?.map((c) => <CartaoConstrucao key={c.slot} c={c} aoEvento={aoEvento} />)}
          {destinos?.map((c) => <CartaoDestino key={c.destino} c={c} aoEvento={aoEvento} />)}
        </ul>
        <Cronica linhas={cronica} />
        {rodape && <div className={estilos.rodapePainel}>{rodape}</div>}
      </div>
    </section>
  );
}

/** Bloco da Crônica, no fim do painel da direita (as linhas mais novas primeiro). */
export function Cronica({ linhas }: { linhas: LinhaCronica[] }) {
  return (
    <>
      <h2 className={estilos.cronicaTitulo}>Crônica</h2>
      {linhas.length === 0 ? (
        <p className={estilos.semLinhas}>Nada aconteceu ainda.</p>
      ) : (
        <ol className={estilos.linhasCronica}>
          {linhas.map((l) => (
            <li key={l.chave} className={estilos.linhaCronica}>
              <img className={estilos.pixel} src={`/icones/${l.icone}.png`} width={32} height={32} alt="" draggable={false} />
              <span>{l.texto}</span>
              <time>{l.hora}</time>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
