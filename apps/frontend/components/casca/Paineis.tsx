'use client';

// Painel lateral (Figma "Construcoes", "Destinos" e "Cronica"), num só bloco
// que rola por dentro: cabeçalho fixo no topo, os cartões e, embaixo, a
// Crônica. Os botões só emitem intenções tipadas: os modais de Melhorar e de
// expedição chegam nos Portões 12 e 13.

import type { DestinoId, SlotId } from '@cronarca/game-core';
import type { ReactNode } from 'react';
import type { CartaConstrucao, CartaDestino, DadosAldeoes, LinhaCronica } from '../../lib/casca/dados';
import { SpriteAnimado } from '../anim/SpriteAnimado';
import estilos from './casca.module.css';
import { Icone } from './Icone';

export type EventoCasca =
  | { tipo: 'melhorarClicado'; slot: SlotId }
  | { tipo: 'enviarClicado'; destino: DestinoId }
  | { tipo: 'verClicado'; destino: DestinoId };

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
 * Aldeões da vila: quantos há e cabem, quando chega o próximo e o que cada
 * ofício faz agora. Chegam sozinhos; o jogador só influi pelas Casas e pela comida.
 */
export function CartaoAldeoes({ d }: { d: DadosAldeoes }) {
  return (
    <section className={`caixa ${estilos.cartao} ${estilos.aldeoes}`} aria-labelledby="titulo-aldeoes">
      <h3 id="titulo-aldeoes" className={estilos.cartaoNome}>
        <Icone nome="icone-aldeao" tamanho={16} />
        Aldeões
        <span className={estilos.nivel}>
          {d.total} de {d.maximo}
        </span>
      </h3>
      <p className={estilos.cartaoTexto}>Chegam sozinhos, um a cada 20 s, enquanto houver vaga nas Casas e comida.</p>
      <p className={`${estilos.cartaoTexto} ${d.alerta ? estilos.alerta : ''}`}>{d.situacao}</p>
      {d.oficios.length > 0 && (
        <ul className={estilos.oficios}>
          {d.oficios.map((o) => (
            <li key={o.oficio} className={o.parado ? estilos.oficioParado : undefined}>
              <span className={estilos.oficioNome}>
                {o.nome} ×{o.quantidade}
              </span>
              <span>{o.efeito}</span>
            </li>
          ))}
        </ul>
      )}
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
        {aldeoes && <CartaoAldeoes d={aldeoes} />}
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
