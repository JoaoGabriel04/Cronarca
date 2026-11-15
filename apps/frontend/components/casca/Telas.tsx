'use client';

// Telas Heróis, Expedições e Eras (Portão 12; Figma "Herois - Desktop",
// "Expedicoes - Desktop" e "Eras - Desktop"). Os dados vêm de lib/casca/telas;
// aqui só o desenho e as intenções. Contratar, Partir e Ascender esperam o
// servidor (sorteiam); melhorar equipamento e comprar relíquia são previstos.

import type { Acao, DestinoId, VisaoCliente } from '@cronarca/game-core';
import { useEffect, useRef, type ReactNode } from 'react';
import { linhasCronica } from '../../lib/casca/dados';
import {
  caminhoDoTempo, cartasHerois, chipsGrupo, emAndamento, eraAtual, guilda, linhasDestinos, relatorios, reliquias,
  type CartaHeroi, type Peca,
} from '../../lib/casca/telas';
import { SpriteAnimado } from '../anim/SpriteAnimado';
import estilos from './casca.module.css';
import { Icone } from './Icone';
import { Cronica } from './Paineis';

export interface AcoesTela {
  /** Ação prevista no cliente (equipamento, relíquia). */
  prevista: (acao: Acao) => void;
  /** Ação que espera o servidor (contratar, partir, ascender); o botão trava enquanto envia. */
  servidor: (acao: Acao) => void;
  enviando: boolean;
}

/** Painel de pergaminho que rola por dentro, com o cabeçalho fixo no topo. */
function Painel({ titulo, subtitulo, extra, children, className = '', rotulo }: { titulo: string; subtitulo?: string; extra?: ReactNode; children: ReactNode; className?: string; rotulo?: string }) {
  return (
    <section className={`caixa pergaminho com-linha ${estilos.painel} ${className}`} aria-label={rotulo ?? titulo}>
      <div className={`${estilos.rolagem} ${estilos.rola}`}>
        <header className={estilos.cabecalho}>
          <h2>{titulo}</h2>
          {subtitulo && <p>{subtitulo}</p>}
          {extra && <div className={estilos.cabecalhoExtra}>{extra}</div>}
        </header>
        {children}
      </div>
    </section>
  );
}

function Custos({ itens, pequeno = false }: { itens: { recurso: string; valor: string }[]; pequeno?: boolean }) {
  return (
    <p className={`${estilos.custos} ${pequeno ? '' : ''}`}>
      {itens.map((k) => (
        <span key={k.recurso}>
          <Icone nome={`icone-${k.recurso}`} tamanho={16} />
          {k.valor}
        </span>
      ))}
    </p>
  );
}

function Retrato({ id, classe, lado }: { id: string; classe: string; lado: 64 | 96 }) {
  return (
    // Moldura do Figma: 120 para o retrato de 96 (3x) e 72 para o de 64 (2x).
    <div className={`caixa ${estilos.retrato}`} style={{ width: lado + (lado === 96 ? 24 : 8), height: lado + (lado === 96 ? 24 : 8) }}>
      <SpriteAnimado className={estilos.pixel} sprite={{ grupo: 'aventureiro', id: classe }} instancia={id} lado={lado} />
    </div>
  );
}

// ---------- Heróis ----------

function Pips({ nivel, maximo }: { nivel: number; maximo: number }) {
  return (
    <span className={estilos.pips} aria-hidden="true">
      {Array.from({ length: maximo }, (_, k) => (
        <span key={k} className={`${estilos.pip} ${k < nivel ? estilos.pipCheio : ''}`} />
      ))}
    </span>
  );
}

function PecaHeroi({ titulo, peca, aoMelhorar }: { titulo: string; peca: Peca; aoMelhorar: () => void }) {
  return (
    <div className={estilos.peca}>
      <p className={estilos.pecaTitulo}>
        {titulo} {peca.nivel} de {peca.maximo}
      </p>
      <Pips nivel={peca.nivel} maximo={peca.maximo} />
      {peca.custo.length > 0 ? <Custos itens={peca.custo} /> : <p className={estilos.cartaoTexto}>Nível máximo</p>}
      <button
        type="button"
        className={`caixa botao botao-dourado ${estilos.botaoCasca} ${estilos.botaoPeca}`}
        disabled={!peca.pode}
        title={peca.motivo ?? undefined}
        onClick={aoMelhorar}
      >
        Melhorar
      </button>
    </div>
  );
}

function CartaoHeroi({ h, acoes }: { h: CartaHeroi; acoes: AcoesTela }) {
  return (
    <li className={`caixa ${estilos.cartao} ${estilos.heroi}`}>
      <Retrato id={h.id} classe={h.classe} lado={96} />
      <div className={estilos.heroiInfo}>
        <div className={estilos.heroiTopo}>
          <div>
            <h3 className={estilos.heroiNome}>{h.nome}</h3>
            <p className={estilos.cartaoTexto}>{h.linha}</p>
          </div>
          <span className={`${estilos.etiqueta} ${estilos[`etiqueta_${h.estado.tipo}`]}`}>{h.estado.texto}</span>
        </div>
        <p className={estilos.poder}>
          <Icone nome="icone-aventureiro" tamanho={16} />
          poder {h.poder}
        </p>
        <div className={estilos.pecas}>
          <PecaHeroi titulo="Arma" peca={h.arma} aoMelhorar={() => acoes.prevista({ tipo: 'melhorar_equipamento', aventureiro: h.id, peca: 'arma' })} />
          <PecaHeroi titulo="Armadura" peca={h.armadura} aoMelhorar={() => acoes.prevista({ tipo: 'melhorar_equipamento', aventureiro: h.id, peca: 'armadura' })} />
        </div>
      </div>
    </li>
  );
}

export function TelaHerois({ estado, agora, acoes }: { estado: VisaoCliente; agora: number; acoes: AcoesTela }) {
  const g = guilda(estado);
  const herois = cartasHerois(estado, agora);
  return (
    <>
      <div className={estilos.principal}>
        <Painel
          titulo="Guilda"
          subtitulo={g.subtitulo}
          extra={
            <div className={estilos.contratar}>
              <button
                type="button"
                className={`caixa botao botao-dourado ${estilos.botaoCasca}`}
                disabled={!g.contratar.pode || acoes.enviando}
                title={g.contratar.motivo ?? undefined}
                onClick={() => acoes.servidor({ tipo: 'contratar' })}
              >
                {acoes.enviando ? 'Contratando...' : 'Contratar aventureiro'}
              </button>
              <Custos itens={g.contratar.custo} />
            </div>
          }
        >
          <ul className={estilos.lista}>
            {herois.map((h) => (
              <CartaoHeroi key={h.id} h={h} acoes={acoes} />
            ))}
          </ul>
        </Painel>
      </div>
      <aside className={estilos.lateral}>
        <Painel titulo="Resumo da guilda" subtitulo={g.resumo.cabecalho}>
          <ul className={estilos.lista}>
            {[
              { icone: 'icone-expedicao', rotulo: 'Poder total', valor: String(g.resumo.poderTotal) },
              // Vagas são de aventureiro (o ícone de aldeão confundia com os aldeões da vila).
              { icone: 'icone-aventureiro', rotulo: 'Vagas na guilda', valor: g.resumo.vagas },
              { icone: 'icone-comida', rotulo: 'Consumo de comida', valor: g.resumo.consumo },
              { icone: 'icone-construir', rotulo: 'Próxima vaga', valor: g.resumo.proximaVaga },
            ].map((l) => (
              <li key={l.rotulo} className={`caixa ${estilos.cartao} ${estilos.linhaResumo}`}>
                <Icone nome={l.icone} />
                <div>
                  <p className={estilos.resumoRotulo}>{l.rotulo}</p>
                  <p className={estilos.resumoValor}>{l.valor}</p>
                </div>
              </li>
            ))}
          </ul>
          <Cronica linhas={linhasCronica(estado, 8)} />
        </Painel>
      </aside>
    </>
  );
}

// ---------- Expedições ----------

export function TelaExpedicoes({
  estado, agora, acoes, selecionados, aoSelecionar, destaque,
}: {
  estado: VisaoCliente; agora: number; acoes: AcoesTela; selecionados: string[]; aoSelecionar: (ids: string[]) => void; destaque: DestinoId | null;
}) {
  const { chips, poder } = chipsGrupo(estado, selecionados);
  const andamento = emAndamento(estado, agora);
  const destinos = linhasDestinos(estado, selecionados);
  const rel = relatorios(estado);
  const refs = useRef<Partial<Record<DestinoId, HTMLLIElement | null>>>({});

  // Veio do mapa ou do painel Destinos: rola até o destino e o destaca.
  useEffect(() => {
    if (destaque) refs.current[destaque]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [destaque]);

  const alternar = (id: string) => aoSelecionar(selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]);

  return (
    <>
      <div className={estilos.principal}>
        <Painel titulo="Grupo" subtitulo="até 3 aventureiros" extra={<p className={estilos.poderGrupo}>Poder do grupo: {poder}</p>}>
          <ul className={estilos.grupo} aria-label="Escolha o grupo">
            {chips.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`caixa ${estilos.chipGrupo} ${c.selecionado ? estilos.selecionado : ''}`}
                  aria-pressed={c.selecionado}
                  disabled={!c.disponivel}
                  title={c.motivo ?? undefined}
                  onClick={() => alternar(c.id)}
                >
                  <Retrato id={c.id} classe={c.classe} lado={64} />
                  <span className={estilos.chipGrupoTexto}>
                    <strong>{c.nome}</strong>
                    <span>{c.motivo && !c.selecionado ? c.motivo : c.linha}</span>
                  </span>
                  {c.selecionado && <Icone nome="icone-check" className={estilos.chipGrupoCheck} />}
                </button>
              </li>
            ))}
          </ul>
          <ul className={estilos.lista}>
            {andamento.map((a) => (
              <li key={a.id} className={`caixa ${estilos.cartao} ${estilos.andamento}`}>
                <Icone nome="icone-expedicao" />
                <div className={estilos.cartaoInfo}>
                  <p className={estilos.andamentoTitulo}>Em andamento</p>
                  <p className={estilos.cartaoTexto}>{a.texto}</p>
                </div>
                <span className={estilos.barra} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(a.progresso * 100)}>
                  <span style={{ width: `${a.progresso * 100}%` }} />
                </span>
                <span className={estilos.andamentoTempo}>{a.restante}</span>
              </li>
            ))}
            {destinos.map((d) => (
              <li
                key={d.destino}
                ref={(el) => {
                  refs.current[d.destino] = el;
                }}
                className={`caixa ${estilos.cartao} ${estilos.linhaDestino} ${d.aberto ? '' : estilos.bloqueado} ${destaque === d.destino ? estilos.destacado : ''}`}
              >
                <SpriteAnimado className={`${estilos.pixel} ${estilos.miniDestino}`} sprite={{ grupo: 'expedicao', id: d.destino }} lado={64} />
                <div className={estilos.cartaoInfo}>
                  <h3 className={estilos.cartaoNome}>{d.nome}</h3>
                  <p className={estilos.cartaoTexto}>{d.descricao}</p>
                  {d.aberto && (
                    <p className={estilos.perigo}>
                      <Icone nome="icone-tempo" tamanho={16} />
                      {d.perigo}
                    </p>
                  )}
                </div>
                {d.aberto ? (
                  <>
                    <div className={estilos.saque} aria-label="Saque possível">
                      {d.saque.map((s) => (
                        <span key={s.recurso}>
                          <Icone nome={`icone-${s.recurso}`} tamanho={16} />
                          {s.faixa}
                        </span>
                      ))}
                    </div>
                    <div className={estilos.chance}>
                      <span>Chance de êxito</span>
                      <strong className={d.chance ? estilos[`chance_${d.chance.nivel}`] : ''}>{d.chance?.texto ?? '—'}</strong>
                    </div>
                    <button
                      type="button"
                      className={`caixa botao botao-dourado ${estilos.botaoCasca} ${estilos.acaoCartao}`}
                      disabled={!d.pode || acoes.enviando}
                      title={d.motivo ?? undefined}
                      onClick={() => acoes.servidor({ tipo: 'partir_expedicao', destino: d.destino, grupo: chips.filter((c) => c.selecionado).map((c) => c.id) })}
                    >
                      Partir
                    </button>
                  </>
                ) : (
                  <>
                    <p className={estilos.requer}>{d.requer}</p>
                    <Icone nome="icone-bloqueado" className={estilos.cadeado} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </Painel>
      </div>
      <aside className={estilos.lateral}>
        <Painel titulo="Relatórios" subtitulo="Últimas expedições">
          {rel.length === 0 ? (
            <p className={estilos.semLinhas}>Nenhuma expedição voltou ainda.</p>
          ) : (
            <ul className={estilos.lista}>
              {rel.map((r) => (
                <li key={r.chave} className={`caixa ${estilos.cartao} ${estilos.relatorio}`}>
                  <Icone nome={r.vitoria ? 'icone-check' : 'icone-alerta'} />
                  <div className={estilos.relatorioCorpo}>
                    <p className={estilos.relatorioTopo}>
                      <strong>{r.nome}</strong>
                      <time>{r.hora}</time>
                    </p>
                    <span className={`${estilos.etiqueta} ${r.vitoria ? estilos.etiqueta_na_vila : estilos.etiqueta_ferido}`}>{r.vitoria ? 'Vitória' : 'Recuou'}</span>
                    <p className={estilos.relatorioTexto}>{r.texto}</p>
                    {r.saque.length > 0 ? <Custos itens={r.saque} /> : <p className={estilos.cartaoTexto}>Nenhum saque.</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Cronica linhas={linhasCronica(estado, 8)} />
        </Painel>
      </aside>
    </>
  );
}

// ---------- Eras ----------

export function TelaEras({ estado, acoes }: { estado: VisaoCliente; acoes: AcoesTela }) {
  const era = eraAtual(estado);
  const rel = reliquias(estado);
  const futuras = caminhoDoTempo(estado);
  return (
    <>
      <div className={estilos.principal}>
        <Painel titulo={era.titulo} subtitulo={era.texto} extra={<span className={`${estilos.etiqueta} ${estilos.etiquetaCiclo}`}>{era.ciclo}</span>}>
          <div className={estilos.eraTopo}>
            <ul className={estilos.lista}>
              {era.objetivos.map((o) => (
                <li key={o.texto} className={`caixa ${estilos.cartao} ${estilos.objetivo}`}>
                  <span className={estilos.caixaMarcar} aria-hidden="true">{o.feito && <Icone nome="icone-check" tamanho={16} />}</span>
                  <div className={estilos.cartaoInfo}>
                    <p className={estilos.objetivoTexto}>
                      <span className={estilos.somenteLeitor}>{o.feito ? 'Feito: ' : 'Pendente: '}</span>
                      {o.texto}
                    </p>
                    {o.progresso && (
                      <p className={estilos.objetivoBarra}>
                        <span className={estilos.barra}>
                          <span style={{ width: `${(o.progresso.atual / o.progresso.total) * 100}%` }} />
                        </span>
                        {o.progresso.atual} / {o.progresso.total}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className={`caixa ${estilos.cartao} ${estilos.ascensao}`}>
              <p>Ascender reinicia vila, aldeões e pesquisas, mas você leva as relíquias.</p>
              {!era.podeAscender && <p className={estilos.ascensaoDica}>Cumpra todos os objetivos</p>}
              <button
                type="button"
                className={`caixa botao ${era.podeAscender ? 'botao-dourado' : ''} ${estilos.botaoCasca}`}
                disabled={!era.podeAscender || acoes.enviando}
                onClick={() => acoes.servidor({ tipo: 'ascender' })}
              >
                Ascender de era
              </button>
            </div>
          </div>
          <div className={estilos.reliquiasTopo}>
            <h3 className={estilos.cronicaTitulo}>Relíquias</h3>
            <p>
              <Icone nome="icone-reliquia" />
              {rel.titulo}
            </p>
          </div>
          <ul className={estilos.reliquias}>
            {rel.cartas.map((r) => (
              <li key={r.id} className={`caixa ${estilos.cartao} ${estilos.reliquia}`}>
                <p className={estilos.reliquiaTopo}>
                  <Icone nome="icone-reliquia" />
                  <span>
                    <strong>{r.nome}</strong>
                    <span>{r.nivel}</span>
                  </span>
                </p>
                <p className={estilos.reliquiaEfeito}>{r.efeito}</p>
                <p className={estilos.reliquiaRodape}>
                  <span>
                    <Icone nome="icone-reliquia" tamanho={16} />
                    {r.custo}
                  </span>
                  <button
                    type="button"
                    className={`caixa botao botao-dourado ${estilos.botaoCasca} ${estilos.botaoComprar}`}
                    disabled={!r.pode}
                    title={r.motivo ?? undefined}
                    onClick={() => acoes.prevista({ tipo: 'comprar_reliquia', reliquia: r.id })}
                  >
                    Comprar
                  </button>
                </p>
              </li>
            ))}
          </ul>
        </Painel>
      </div>
      <aside className={estilos.lateral}>
        <Painel titulo="O caminho do tempo" subtitulo="As próximas eras ainda estão sendo forjadas.">
          <ul className={estilos.lista}>
            {futuras.map((f) => (
              <li key={f.numero} className={`caixa ${estilos.cartao} ${estilos.eraFutura}`}>
                <div className={`caixa ${estilos.molduraEra}`}>
                  <SpriteAnimado className={estilos.pixel} sprite={f.sprite} lado={96} />
                </div>
                <div className={estilos.cartaoInfo}>
                  <h3 className={estilos.heroiNome}>{f.titulo}</h3>
                  <span className={`${estilos.etiqueta} ${estilos.etiquetaBloqueada}`}>Bloqueada</span>
                  <p className={estilos.eraTexto}>{f.texto}</p>
                </div>
                <p className={estilos.eraLiberacao}>
                  <Icone nome="icone-bloqueado" />
                  {f.liberacao}
                </p>
              </li>
            ))}
          </ul>
        </Painel>
      </aside>
    </>
  );
}
