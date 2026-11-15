'use client';

// Modais do Portão 13 (Figma "Modal Melhorar/Construir/Pesquisa/Ascensao/
// Configuracoes - Desktop"). Mostram o que lib/casca/modais calcula e só
// emitem intenções; quem envia ao servidor é o JogoAoVivo.

import type { PesquisaId } from '@cronarca/game-core';
import { ArrowRight, Hourglass } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { CartaPesquisa, CustoModal, DadosObra, dadosAscensao } from '../../lib/casca/modais';
import { Icone } from './Icone';
import { Modal } from './Modal';
import { SpriteAnimado } from '../anim/SpriteAnimado';
import estilos from './modais.module.css';

function Custos({ itens, tempo }: { itens: CustoModal[]; tempo?: string }) {
  return (
    <p className={estilos.custos}>
      {itens.map((c) => (
        <span key={c.recurso} className={c.falta ? estilos.falta : ''} title={c.falta ? 'Falta este recurso' : undefined}>
          <Icone nome={`icone-${c.recurso}`} tamanho={16} />
          {c.valor}
        </span>
      ))}
      {tempo && (
        <span className={estilos.tempo}>
          <Icone nome="icone-tempo" tamanho={16} />
          {tempo}
        </span>
      )}
    </p>
  );
}

function Botoes({ voltar, confirmar }: { voltar: ReactNode; confirmar: ReactNode }) {
  return (
    <div className={estilos.botoes}>
      {voltar}
      {confirmar}
    </div>
  );
}

// ---------- Melhorar (construir é pelo Catálogo, A12) ----------

export function ModalObra({
  dados, enviando, aoConfirmar, aoFechar,
}: { dados: DadosObra; enviando: boolean; aoConfirmar: () => void; aoFechar: () => void }) {
  return (
    <Modal titulo={dados.nome} etiqueta={dados.etiqueta} largura="media" aoFechar={aoFechar}>
      <div className={estilos.obra}>
        <div className={`caixa ${estilos.retratoObra}`}>
          <SpriteAnimado className={estilos.pixel} sprite={dados.sprite} instancia={dados.slot} lado={144} />
        </div>
        <div className={estilos.obraInfo}>
          <div className={`caixa ${estilos.cartao} ${estilos.efeito}`}>
            {dados.hoje !== null && (
              <>
                <div>
                  <p className={estilos.rotulo}>Hoje</p>
                  <p className={estilos.valorEfeito}>{dados.hoje}</p>
                </div>
                <ArrowRight className={estilos.seta} size={24} strokeWidth={3} aria-hidden="true" />
              </>
            )}
            {dados.situacao !== 'maximo' && (
              <div>
                <p className={estilos.rotulo}>No nível {dados.alvo}</p>
                <p className={`${estilos.valorEfeito} ${estilos.ganho}`}>{dados.depois}</p>
              </div>
            )}
            {dados.situacao === 'maximo' && <p className={estilos.rotulo}>Nível máximo: não há próximo nível.</p>}
          </div>
          {dados.situacao === 'obra' ? (
            <div className={`caixa ${estilos.cartao}`}>
              <p className={estilos.rotulo}>Em obra</p>
              <p className={estilos.custos}>
                <span className={estilos.tempo}>
                  <Icone nome="icone-tempo" tamanho={16} />
                  {dados.restante} restantes
                </span>
              </p>
            </div>
          ) : (
            dados.situacao === 'pronta' && (
              <div className={`caixa ${estilos.cartao}`}>
                <p className={estilos.rotulo}>Custo</p>
                <Custos itens={dados.custo} tempo={`${dados.tempo} de obra`} />
              </div>
            )
          )}
        </div>
      </div>
      <p className={estilos.nota}>{dados.nota}</p>
      <Botoes
        voltar={
          <button type="button" className={`caixa botao ${estilos.botao}`} onClick={aoFechar}>
            Cancelar
          </button>
        }
        confirmar={
          <button
            type="button"
            className={`caixa botao botao-dourado ${estilos.botao} ${estilos.principal}`}
            disabled={!dados.pode || enviando}
            title={dados.motivo ?? undefined}
            onClick={aoConfirmar}
          >
            {dados.situacao === 'obra' ? 'Em obra' : dados.situacao === 'maximo' ? 'Máximo' : 'Melhorar'}
          </button>
        }
      />
      {dados.motivo && dados.situacao === 'pronta' && <p className={estilos.motivo}>{dados.motivo}</p>}
    </Modal>
  );
}

// ---------- Pesquisa ----------

function CartaoPesquisa({ c, aoPesquisar }: { c: CartaPesquisa; aoPesquisar: (id: PesquisaId) => void }) {
  return (
    <li className={`caixa ${estilos.cartao} ${estilos.pesquisa} ${estilos[`pesquisa_${c.estado}`]}`}>
      <div className={`caixa ${estilos.livro}`}>
        <Icone nome="icone-saber" />
      </div>
      <div className={estilos.pesquisaInfo}>
        <h3 className={estilos.nomeCartao}>{c.nome}</h3>
        <p className={estilos.texto}>{c.descricao}</p>
        {c.estado !== 'concluida' && <Custos itens={c.custo} tempo={c.tempo} />}
      </div>
      <div className={estilos.pesquisaAcao}>
        {c.estado === 'concluida' && (
          <span className={estilos.concluida}>
            <Icone nome="icone-check" />
            <span className={estilos.etiquetaVerde}>Concluída</span>
          </span>
        )}
        {c.estado === 'andamento' && (
          <div className={estilos.andamento}>
            <p className={estilos.emAndamento}>Em andamento</p>
            <div className={estilos.barra} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((c.progresso ?? 0) * 100)}>
              <span style={{ width: `${Math.round((c.progresso ?? 0) * 100)}%` }} />
            </div>
            <p className={estilos.restante}>{c.restante}</p>
          </div>
        )}
        {c.estado === 'disponivel' && (
          <button
            type="button"
            className={`caixa botao botao-dourado ${estilos.botao} ${estilos.pesquisar}`}
            disabled={!c.pode}
            title={c.motivo ?? undefined}
            onClick={() => aoPesquisar(c.id)}
          >
            Pesquisar
          </button>
        )}
        {c.estado === 'bloqueada' && (
          <span className={estilos.bloqueada}>
            <Icone nome="icone-bloqueado" />
            <span>{c.requer}</span>
          </span>
        )}
      </div>
    </li>
  );
}

export function ModalPesquisa({
  dados, aoPesquisar, aoFechar,
}: { dados: { saber: string; subtitulo: string; cartas: CartaPesquisa[] }; aoPesquisar: (id: PesquisaId) => void; aoFechar: () => void }) {
  return (
    <Modal
      titulo="Pesquisa"
      subtitulo={dados.subtitulo}
      largura="larga"
      aoFechar={aoFechar}
      extra={
        <p className={estilos.saber}>
          <Icone nome="icone-saber" />
          {dados.saber}
        </p>
      }
    >
      <ul className={estilos.lista}>
        {dados.cartas.map((c) => (
          <CartaoPesquisa key={c.id} c={c} aoPesquisar={aoPesquisar} />
        ))}
      </ul>
    </Modal>
  );
}

// ---------- Ascensão ----------

export function ModalAscensao({
  dados, enviando, aoConfirmar, aoFechar,
}: { dados: ReturnType<typeof dadosAscensao>; enviando: boolean; aoConfirmar: () => void; aoFechar: () => void }) {
  return (
    <Modal titulo="Ascender de era" subtitulo="Esta ação não pode ser desfeita." subtituloAlerta largura="ascensao" aoFechar={aoFechar}>
      <div className={`caixa ${estilos.cartao} ${estilos.rumo}`}>
        <div className={`caixa ${estilos.retratoEra}`}>
          <SpriteAnimado className={estilos.pixel} sprite={{ grupo: 'construcao', id: 'casa' }} lado={96} />
        </div>
        <div className={estilos.rumoInfo}>
          <p className={estilos.eraRumo}>{dados.era}</p>
          <p className={estilos.ciclos}>
            <span className={estilos.de}>{dados.de}</span>
            <ArrowRight className={estilos.seta} size={24} strokeWidth={3} aria-hidden="true" />
            <span className={estilos.para}>{dados.para}</span>
          </p>
          <p className={estilos.ganhoReliquias}>
            <Icone nome="icone-reliquia" />
            {dados.ganho}
          </p>
        </div>
      </div>
      <div className={`caixa ${estilos.cartao} ${estilos.falhaModal}`}>
        <h3 className={`${estilos.nomeCartao} ${estilos.vermelho}`}>
          <Hourglass size={20} strokeWidth={2.5} aria-hidden="true" />
          {dados.falha.proximo?.titulo ?? dados.falha.rotulo}
        </h3>
        {dados.falha.proximo ? (
          <ul className={estilos.itens}>
            {dados.falha.proximo.efeitos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className={estilos.falhaLore}>{dados.falha.noMaximo}</p>
        )}
        <p className={estilos.falhaLore}>{dados.falha.lore}</p>
      </div>
      <div className={estilos.colunas}>
        <div className={`caixa ${estilos.cartao}`}>
          <h3 className={`${estilos.nomeCartao} ${estilos.vermelho}`}>
            <Icone nome="icone-alerta" />
            Reinicia
          </h3>
          <ul className={estilos.itens}>
            {dados.reinicia.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className={`caixa ${estilos.cartao}`}>
          <h3 className={`${estilos.nomeCartao} ${estilos.verde}`}>
            <Icone nome="icone-check" />
            Você leva
          </h3>
          <ul className={estilos.itens}>
            {dados.leva.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
      <Botoes
        voltar={
          <button type="button" className={`caixa botao ${estilos.botao}`} onClick={aoFechar}>
            Voltar
          </button>
        }
        confirmar={
          <button
            type="button"
            className={`caixa botao botao-dourado ${estilos.botao} ${estilos.principal}`}
            disabled={!dados.pode || enviando}
            title={dados.pode ? undefined : 'Cumpra os objetivos da era'}
            onClick={aoConfirmar}
          >
            Ascender
          </button>
        }
      />
    </Modal>
  );
}

// ---------- Configurações ----------

function Interruptor({ ligado, rotulo, desativado = false, aoTrocar }: { ligado: boolean; rotulo: string; desativado?: boolean; aoTrocar?: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      className={`caixa ${estilos.interruptor} ${ligado ? estilos.ligado : ''}`}
      disabled={desativado}
      onClick={aoTrocar}
    >
      <span />
    </button>
  );
}

export interface PropsConfiguracoes {
  animacoes: boolean;
  aoTrocarAnimacoes: () => void;
  /** "Salvo há 12s", "Salvando…", "Sem conexão" (o mesmo indicador das abas). */
  salvo: string;
  salvando: boolean;
  aoSalvar: () => void;
  aoBaixar: () => void;
  conta: { nome: string; email: string } | null;
  /** Botão de sair (o mesmo da tela de entrada). */
  sair: ReactNode;
  apagando: boolean;
  /** Recebe a palavra digitada; o servidor confere. */
  aoApagar: (confirmacao: string) => void;
  palavraApagar: string;
  /** Abre o Ranking (no celular o topo não comporta o botão; ver casca.module.css). */
  aoRanking: () => void;
  aoFechar: () => void;
}

export function ModalConfiguracoes(p: PropsConfiguracoes) {
  const [confirmando, setConfirmando] = useState(false);
  const [palavra, setPalavra] = useState('');
  return (
    <Modal titulo="Configurações" largura="estreita" aoFechar={p.aoFechar}>
      <section className={`caixa ${estilos.cartao} ${estilos.secao}`} aria-labelledby="cfg-audio">
        <h3 id="cfg-audio" className={estilos.nomeCartao}>Áudio</h3>
        <p className={estilos.texto}>Em breve: o reino ainda não tem sons.</p>
        {['Música', 'Efeitos'].map((nome) => (
          <div key={nome} className={estilos.linhaConfig}>
            <span>{nome}</span>
            <input type="range" className={estilos.volume} disabled aria-label={`Volume de ${nome.toLowerCase()} (em breve)`} defaultValue={0} />
            <Interruptor ligado={false} rotulo={`${nome} (em breve)`} desativado />
          </div>
        ))}
      </section>

      <section className={`caixa ${estilos.cartao} ${estilos.secao}`} aria-labelledby="cfg-jogo">
        <h3 id="cfg-jogo" className={estilos.nomeCartao}>Jogo</h3>
        <div className={estilos.linhaConfig}>
          <span>Animações dos sprites</span>
          <Interruptor ligado={p.animacoes} rotulo="Animações dos sprites" aoTrocar={p.aoTrocarAnimacoes} />
        </div>
        <div className={`${estilos.linhaConfig} ${estilos.soCelularLinha}`}>
          <span>Ranking dos reinos</span>
          <button type="button" className={`caixa botao ${estilos.botaoPequeno}`} onClick={p.aoRanking}>
            Ver ranking
          </button>
        </div>
      </section>

      <section className={`caixa ${estilos.cartao} ${estilos.secao}`} aria-labelledby="cfg-salvar">
        <h3 id="cfg-salvar" className={estilos.nomeCartao}>Salvamento</h3>
        <p className={estilos.texto}>{p.salvo}</p>
        <div className={estilos.acoesLinha}>
          <button type="button" className={`caixa botao botao-dourado ${estilos.botaoPequeno}`} disabled={p.salvando} onClick={p.aoSalvar}>
            {p.salvando ? 'Salvando…' : 'Salvar agora'}
          </button>
          <button type="button" className={`caixa botao ${estilos.botaoPequeno}`} onClick={p.aoBaixar}>
            Baixar cópia
          </button>
        </div>
        <p className={estilos.dica}>O jogo salva sozinho no servidor. A cópia é só para guardar: não dá para carregá-la de volta.</p>
      </section>

      {p.conta && (
        <section className={`caixa ${estilos.cartao} ${estilos.secao}`} aria-labelledby="cfg-conta">
          <h3 id="cfg-conta" className={estilos.nomeCartao}>Conta</h3>
          <div className={estilos.linhaConfig}>
            <span className={estilos.texto}>
              {p.conta.nome} · {p.conta.email}
            </span>
            <span className={estilos.sair}>{p.sair}</span>
          </div>
        </section>
      )}

      <section className={`caixa ${estilos.cartao} ${estilos.secao} ${estilos.risco}`} aria-labelledby="cfg-risco">
        <h3 id="cfg-risco" className={`${estilos.nomeCartao} ${estilos.vermelho}`}>Zona de risco</h3>
        {!confirmando ? (
          <div className={estilos.linhaConfig}>
            <span className={estilos.texto}>Apaga a vila, os heróis e as relíquias desta conta.</span>
            <button type="button" className={`caixa botao ${estilos.botaoPequeno} ${estilos.botaoRisco}`} onClick={() => setConfirmando(true)}>
              Apagar progresso
            </button>
          </div>
        ) : (
          <form
            className={estilos.confirmarApagar}
            onSubmit={(e) => {
              e.preventDefault();
              if (palavra === p.palavraApagar) p.aoApagar(palavra);
            }}
          >
            <label className={estilos.texto} htmlFor="cfg-palavra">
              Não tem volta: o reino recomeça do zero. Digite <strong>{p.palavraApagar}</strong> para confirmar.
            </label>
            <input
              id="cfg-palavra"
              className={`campo ${estilos.campoApagar}`}
              value={palavra}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setPalavra(e.target.value)}
            />
            <div className={estilos.acoesLinha}>
              <button
                type="button"
                className={`caixa botao ${estilos.botaoPequeno}`}
                onClick={() => {
                  setConfirmando(false);
                  setPalavra('');
                }}
              >
                Cancelar
              </button>
              <button type="submit" className={`caixa botao ${estilos.botaoPequeno} ${estilos.botaoRisco}`} disabled={palavra !== p.palavraApagar || p.apagando}>
                {p.apagando ? 'Apagando…' : 'Apagar de vez'}
              </button>
            </div>
          </form>
        )}
      </section>
    </Modal>
  );
}
