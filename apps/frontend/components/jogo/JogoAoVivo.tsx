'use client';

// /jogo de verdade: a casca da interface (Portão 11) em volta do mapa, com o
// estado do jogador vindo do servidor e a previsão no cliente (Portão 10),
// as telas (Portão 12) e os modais (Portão 13). Carregando: tela de carregamento.

import {
  construiveis, CONSTRUCOES, DESTINOS, linhasCatalogo, mapaDaVersao, NOMES_RECURSOS, PALAVRA_APAGAR, PESQUISAS, preverEstado, proximoPasso, recursoDoObjeto, SLOTS, TEXTOS_QG,
  type Acao, type CapituloId, type DestinoId, type PesquisaId, type Recurso, type SlotId,
} from '@cronarca/game-core';
import { gsap } from 'gsap';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  cartasConstrucoes, cartasDestinos, chipsHud, dadosAldeoes, dadosMercador, linhasCronica, textoEra, textoSalvo, type Sincronia,
} from '../../lib/casca/dados';
import { dadosAscensao, dadosMelhorar, dadosPesquisa, dadosReerguerQg, linhasCatalogoTela, seloConstruir, seloPesquisa } from '../../lib/casca/modais';
import { grupoSugerido, grupoValido } from '../../lib/casca/telas';
import { enviar, ErroApi, mensagemDeErro } from '../../lib/api';
import { textoDoDesfecho, useAvisar } from '../../lib/jogo/avisos';
import { avisoLimiteCliques } from '../../lib/jogo/cliques';
import { apagarComTentativas, textoDaFalhaDoReset } from '../../lib/jogo/reset';
import { ProvedorConfirmacao, usePedidoConfirmacao } from '../../lib/jogo/confirmacao';
import { usePreferencias } from '../../lib/jogo/preferencias';
import type { CorpoEstado } from '../../lib/jogo/sincronia';
import { useAcaoServidor, useJogo } from '../../lib/jogo/useJogo';
import { useUsuario } from '../../lib/usuario';
import { AVISO_CONVIDADO, lerRetornoVinculo, semParametrosDeVinculo, type RetornoVinculo } from '../../lib/convidado';
import { ModalVinculo } from '../casca/Vinculo';
import type { EventoMapa } from '../../lib/mapa/acerto';
import { limitarZoom, zoomMinimoQueCobre, type Camera, type Tamanho } from '../../lib/mapa/camera';
import { nevoasAtivas } from '../../lib/mapa/nevoa';
import { areaDoMapa } from '../../lib/mapa/visoes';
import { Abas, IndicadorSalvo, type Aba } from '../casca/Abas';
import { BotaoConstrucoes, CartaoCronica, GavetaDestinos } from '../casca/Celular';
import { useCelular } from '../../lib/casca/celular';
import estilos from '../casca/casca.module.css';
import { Hud } from '../casca/Hud';
import { Catalogo } from '../casca/Catalogo';
import { ModalAscensao, ModalConfiguracoes, ModalObra, ModalPesquisa, ModalReerguerQg } from '../casca/Modais';
import { ModalRanking } from '../casca/Ranking';
import { ChipObjetivo, FaixaObjetivo, ModalDiario, ModalObjetivo, ModalPrologo } from '../casca/Objetivo';
import { deveAbrirPrologo, gravarLidos, lerLidos, linhasDiario, marcarPrologoNoNavegador, novosNoDiario, prologoVistoNoNavegador } from '../../lib/casca/diario';
import { CartaoAldeoes, PainelLateral, type EventoCasca } from '../casca/Paineis';
import { TelaEras, TelaExpedicoes, TelaHerois, type AcoesTela } from '../casca/Telas';
import { AlternarVisao, BotaoConstruirFlutuante, ChipEvento, ControleZoom, Minimapa, PopupMercador, type Visao } from '../casca/SobreMapa';
import { CanvasMapa, type CliqueObjeto, type ControleMapa } from '../mapa/CanvasMapa';
import { BotaoSair } from '../../app/jogo/BotaoSair';
import { CarregandoReino } from './CarregandoReino';
import { definirPreferenciaAnimacao } from '../../lib/anim/movimento';
import { usePreCarga } from '../../lib/anim/precarga';

/** O HUD e os painéis liquidam a previsão uma vez por segundo. */
const PASSO_MS = 1_000;
const ZOOM_MAXIMO = limitarZoom(99);

/** Modal aberto (o de Ascensão abre pelo pedido de confirmação, não por aqui). */
type ModalAberto =
  | { tipo: 'obra'; slot: SlotId }
  /** Catálogo (A12): `ordem` guardada ao abrir, para as linhas não pularem; `foco` veio do mapa. */
  | { tipo: 'catalogo'; foco: SlotId | null; ordem: SlotId[] }
  | { tipo: 'pesquisa' }
  | { tipo: 'configuracoes' }
  | { tipo: 'ranking' }
  /** Reerguer o Quartel General (Portão 21). */
  | { tipo: 'reerguerQg' }
  /** Vínculo da conta de convidado (Portão B); `retorno` vem do callback do Google ou Discord. */
  | { tipo: 'vinculo'; retorno: RetornoVinculo | null }
  /** Portão 16: painel dos objetivos, Diário e prólogo. */
  | { tipo: 'objetivo' }
  | { tipo: 'diario' }
  | { tipo: 'prologo' }
  | null;

/** Baixa a cópia somente leitura do reino (Configurações): o estado visível, sem a parte secreta. */
function baixarCopia(corpo: unknown, ciclo: number) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(corpo, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `cronarca-ciclo-${ciclo}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

interface PropsJogo {
  depuracao?: boolean;
  acoesDepuracao?: ReactNode;
}

/** O confirmador de ascender precisa estar acima de quem pede a ação. */
export function JogoAoVivo(props: PropsJogo) {
  return (
    <ProvedorConfirmacao>
      <Jogo {...props} />
    </ProvedorConfirmacao>
  );
}

function Jogo({ depuracao = false, acoesDepuracao }: PropsJogo) {
  const jogo = useJogo();
  const acaoServidor = useAcaoServidor(jogo);
  const confirmacao = usePedidoConfirmacao();
  const { preferencias, definir } = usePreferencias();
  // Todos os quadros animados carregam atrás da tela de carregamento (sem piscar na troca).
  const quadrosProntos = usePreCarga();
  useEffect(() => definirPreferenciaAnimacao(preferencias.animacoes), [preferencias.animacoes]);
  const { usuario } = useUsuario();
  const [modal, setModal] = useState<ModalAberto>(null);
  // "Ranking dos Reinos" da tela inicial chega com ?ranking: abre o modal e limpa o endereço.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('ranking')) return;
    setModal({ tipo: 'ranking' });
    url.searchParams.delete('ranking');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);
  // Retorno do vínculo por Google ou Discord (?vinculo=nome ou ?vinculo_erro=...): abre o modal e limpa o endereço.
  useEffect(() => {
    const url = new URL(window.location.href);
    const retorno = lerRetornoVinculo(url.searchParams);
    if (!retorno) return;
    setModal({ tipo: 'vinculo', retorno });
    window.history.replaceState(window.history.state, '', semParametrosDeVinculo(url));
  }, []);
  const [salvando, setSalvando] = useState(false);
  const [apagando, setApagando] = useState(false);
  /** Construíveis no momento em que o catálogo abriu: o selo some até aparecer um novo. */
  const [vistos, setVistos] = useState<ReadonlySet<SlotId>>(new Set());
  /** Slot cuja obra (construir ou melhorar pelo catálogo) espera o servidor (o catálogo fecha com a confirmação). */
  const [construindo, setConstruindo] = useState<SlotId | null>(null);
  /** Grupo da expedição: começa vazio; só quem está na vila entra (lib/casca/telas). */
  const [selecionados, setSelecionados] = useState<string[]>([]);
  /** Destino em destaque na aba Expedições (veio do mapa ou do painel Destinos). */
  const [destaque, setDestaque] = useState<DestinoId | null>(null);
  const avisar = useAvisar();
  const router = useRouter();
  const avisouLimite = useRef(false);
  // Aviso discreto, uma vez por sessão do navegador, para quem ainda é convidado.
  const eConvidado = usuario?.convidado === true;
  useEffect(() => {
    if (!eConvidado) return;
    try {
      if (sessionStorage.getItem('cronarca_aviso_convidado')) return;
      sessionStorage.setItem('cronarca_aviso_convidado', '1');
    } catch {
      // sem armazenamento: avisa mesmo assim
    }
    avisar(AVISO_CONVIDADO);
  }, [eConvidado, avisar]);
  const [tique, setTique] = useState(0);
  const [aba, setAba] = useState<Aba>('vila');
  const [visao, setVisao] = useState<Visao>('reino');
  const [pulso, setPulso] = useState<{ recurso: Recurso; n: number } | null>(null);
  const [respondendo, setRespondendo] = useState(false);
  /** Mapa estreito (frame mobile): na Vila o evento fica no chip até o jogador tocar nele. */
  const [popupAberto, setPopupAberto] = useState(false);
  /** Celular (até 600 px): Vila e Reino em 2x, Construções e Crônica abaixo da Vila, gaveta de Destinos no Reino. */
  const celular = useCelular();
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const mapa = useRef<ControleMapa>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const coluna = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTique((t) => t + 1), PASSO_MS);
    return () => clearInterval(id);
  }, []);

  const base = jogo.estado;
  const relogio = jogo.relogio;
  const visivel = useMemo(() => (base && tique >= 0 ? jogo.sinc.exibir() : null), [base, tique]);
  const versaoMapa = visivel?.mundo.versaoMapa;
  // Névoa do minimapa: só muda quando a pesquisa que abre o destino termina.
  const chaveNevoas = visivel ? nevoasAtivas(visivel).map((n) => n.destino).join(',') : '';
  const nevoasMini = useMemo(() => (visivel ? nevoasAtivas(visivel) : []), [chaveNevoas]);
  const mundo = useMemo(() => (versaoMapa === undefined ? null : mapaDaVersao(versaoMapa)), [versaoMapa]);

  // Entrou ou saiu do layout do celular: a visão atual com a câmera daquele layout (2x na Vila do celular).
  useEffect(() => {
    mapa.current?.irPara(visao === 'vila' ? 'vila' : 'mapa');
    // Só a troca de layout move a câmera (a troca de visão já move em trocarVisao).
  }, [celular]);
  // A gaveta fecha ao sair do Reino ou da aba Vila.
  useEffect(() => {
    if (visao !== 'reino' || aba !== 'vila') setGavetaAberta(false);
  }, [visao, aba]);

  // Transições (GSAP): troca de aba e troca do painel da direita.
  useEffect(() => {
    if (conteudo.current) gsap.fromTo(conteudo.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
  }, [aba]);
  useEffect(() => {
    if (coluna.current) gsap.fromTo(coluna.current, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.25, ease: 'power2.out' });
  }, [visao]);

  // Portão 16: capítulos já abertos neste navegador (ponto de "novo") e o prólogo na primeira entrada.
  const [lidos, setLidos] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => setLidos(lerLidos()), []);
  const prologoPedido = useRef(false);
  useEffect(() => {
    if (prologoPedido.current || !visivel || !quadrosProntos || modal || visivel.mercador) return;
    if (deveAbrirPrologo(visivel, prologoVistoNoNavegador())) {
      prologoPedido.current = true;
      setModal({ tipo: 'prologo' });
    }
  }, [visivel, quadrosProntos, modal]);

  if (!visivel || !mundo || !quadrosProntos) return <CarregandoReino erro={Boolean(jogo.erro)} aoTentarDeNovo={jogo.recarregar} />;

  const agora = relogio();
  const mercador = dadosMercador(visivel, agora);
  const construcoes = cartasConstrucoes(visivel, agora);
  const destinos = cartasDestinos(visivel, agora);
  const sincronia: Sincronia = { ...jogo.sinc.sincronia(), semConexao: jogo.sinc.sincronia().semConexao || Boolean(jogo.erro) };
  const selo = seloConstruir(visivel, vistos);
  const passo = proximoPasso(visivel);
  const novosDiario = novosNoDiario(visivel, lidos);
  const abrirCapitulo = (id: CapituloId) => {
    if (lidos.has(id)) return;
    const novos = new Set([...lidos, id]);
    setLidos(novos);
    gravarLidos(novos);
  };
  const fecharPrologo = () => {
    marcarPrologoNoNavegador();
    setModal(null);
    if (!visivel.prologoVisto) void enviarPrevista({ tipo: 'fechar_prologo' });
  };

  // Enviar/Ver (painel Destinos) e pin aberto no mapa levam à aba Expedições no
  // destino. Melhorar (painel), slot vazio e construção no mapa abrem o modal
  // da obra; o Scriptorium abre a Pesquisa (handoff, Decisões do Portão 0).
  const aoEvento = (e: EventoCasca | EventoMapa) => {
    if (depuracao) console.info('[casca]', e);
    switch (e.tipo) {
      case 'enviarClicado':
        // "Enviar" já traz o grupo: quem está na vila, do mais forte, até 3 (dá para trocar).
        if (grupoValido(visivel, selecionados).length === 0) setSelecionados(grupoSugerido(visivel));
        setDestaque(e.destino);
        setAba('expedicoes');
        return;
      case 'verClicado':
        setDestaque(e.destino);
        setAba('expedicoes');
        return;
      case 'pinClicado':
        if (e.estado === 'bloqueado') {
          const requer = DESTINOS[e.destino].requer;
          avisar(requer ? `${DESTINOS[e.destino].nome}: requer ${PESQUISAS[requer].nome}.` : `${DESTINOS[e.destino].nome} está bloqueada.`);
          return;
        }
        setDestaque(e.destino);
        setAba('expedicoes');
        return;
      case 'construcaoClicada':
        // Primeira obra (nível 0): ainda é o fluxo de construir, então o catálogo na linha dela.
        if (visivel.slots[e.slotId].nivel === 0) abrirCatalogo(e.slotId);
        else setModal(CONSTRUCOES[SLOTS[e.slotId].tipo].cliqueAbre === 'pesquisa' ? { tipo: 'pesquisa' } : { tipo: 'obra', slot: e.slotId });
        return;
      case 'melhorarClicado':
        setModal({ tipo: 'obra', slot: e.slot });
        return;
      case 'qgClicado':
        // Ruínas: abre o modal de reerguer. Já reerguido: a tela da Tropa e a Mesa de Guerra chegam no Portão 22.
        if (visivel.qg.estado === 'ruinas') setModal({ tipo: 'reerguerQg' });
        else avisar(TEXTOS_QG.reerguidoAviso);
        return;
      case 'slotVazioClicado':
        // A12: o terreno vazio abre o catálogo já na linha daquele slot.
        abrirCatalogo(e.slotId);
        return;
      case 'alocarAldeao':
        // Prevista: o número muda na hora; o servidor confere (e recusa se faltar aldeão).
        void enviarPrevista({ tipo: 'alocar_aldeoes', de: e.de, para: e.para, quantidade: 1 });
        return;
      case 'configurarAldeoes':
        void enviarPrevista({ tipo: 'configurar_aldeoes', automatica: e.automatica, politica: e.politica });
        return;
    }
  };

  function abrirCatalogo(foco: SlotId | null) {
    setVistos(new Set(construiveis(visivel!)));
    setModal({ tipo: 'catalogo', foco, ordem: linhasCatalogo(visivel!, relogio()).map((l) => l.slot) });
  }

  /**
   * Construir ou melhorar pelo catálogo (a linha já mostrou o resumo): a obra
   * aparece prevista; com a confirmação do servidor o catálogo fecha, o jogo
   * vai para a Vila e a câmera anima até o slot, que pisca. Recusa: aviso e o
   * catálogo continua aberto.
   */
  const obraPeloCatalogo = async (tipo: 'construir' | 'melhorar', slot: SlotId) => {
    if (construindo) return;
    setConstruindo(slot);
    const d = await enviarPrevista({ tipo, slot });
    setConstruindo(null);
    if (!d.ok) return;
    setModal(null);
    setAba('vila');
    setVisao('vila');
    // Dois quadros: a coluna do mapa volta a aparecer e o ResizeObserver mede o tamanho certo antes da câmera.
    requestAnimationFrame(() => requestAnimationFrame(() => mapa.current?.focarSlot(slot)));
  };

  /** Ação prevista (obra, pesquisa): muda a tela na hora; recusa e rede viram aviso. */
  const enviarPrevista = (acao: Acao) =>
    jogo.sinc.enviar(acao).then((d) => {
      const texto = textoDoDesfecho(d);
      if (texto) avisar(texto);
      return d;
    });

  const salvarAgora = async () => {
    setSalvando(true);
    try {
      const desfechos = await jogo.sinc.salvarAgora();
      await jogo.revalidar();
      const falha = desfechos.find((d) => !d.ok && d.motivo !== 'recusada' && d.motivo !== 'sem_confirmacao');
      avisar(falha ? textoDoDesfecho(falha) ?? 'Não deu para salvar agora.' : 'Reino salvo.');
    } catch {
      avisar('Não deu para salvar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const apagarProgresso = async (palavra: string) => {
    setApagando(true);
    try {
      // O reset apaga tudo: o que estava pendente (cliques, obras) não vale mais, e esperar a fila podia travar a tela.
      jogo.sinc.descartarPendentes();
      const d = await apagarComTentativas({
        transporte: (sinal) =>
          fetch('/api/game/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ confirmacao: palavra }),
            signal: sinal,
          }).then(async (res) => ({ status: res.status, corpo: await res.json().catch(() => ({})) })),
        esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
        agendar: (fn, ms) => setTimeout(fn, ms),
        cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      });
      if (!d.ok) {
        if (d.motivo === 'sessao') router.replace('/login?voltar=/jogo');
        else avisar(textoDaFalhaDoReset(d));
        return;
      }
      // O estado novo vence qualquer base anterior, mesmo com rev menor; o jogador continua no reino novo.
      jogo.sinc.receberEstado(d.corpo, { adotar: true });
      setModal(null);
      setSelecionados([]);
      setDestaque(null);
      setAba('vila');
      avisar('Progresso apagado. O reino recomeça do zero.');
    } catch {
      avisar('Não foi possível apagar o progresso. Tente de novo.');
    } finally {
      setApagando(false);
    }
  };

  const acoesTela: AcoesTela = {
    prevista: (acao: Acao) => {
      void enviarPrevista(acao);
    },
    servidor: (acao: Acao) => {
      void acaoServidor.executar(acao).then((d) => {
        if (d?.ok && acao.tipo === 'partir_expedicao') setSelecionados([]);
        // Ascendeu: o ciclo novo começa na Vila.
        if (d?.ok && acao.tipo === 'ascender') {
          setSelecionados([]);
          setDestaque(null);
          setAba('vila');
        }
      });
    },
    enviando: acaoServidor.enviando,
  };

  const clicarObjeto = (id: string): CliqueObjeto => {
    const r = jogo.sinc.clicar(id);
    const recurso = recursoDoObjeto(visivel, id, {});
    if (r.ganho > 0 && recurso) setPulso((p) => ({ recurso, n: (p?.n ?? 0) + 1 }));
    // Primeira vez que o teto barra o clique nesta visita: explica o limite (o rótulo "Máx. N/s" sobe do clique).
    if (r.limite && !avisouLimite.current) {
      avisouLimite.current = true;
      avisar(avisoLimiteCliques());
    }
    return {
      ganho: r.ganho,
      cheio: r.cheio,
      limite: r.limite,
      ganhoPorCliqueMicro: r.ganhoPorCliqueMicro,
      aceito: r.desfecho.then((d) => {
        // Clique recusado (limite, objeto) é silencioso: o "+N" some. Rede e sessão avisam.
        const texto = textoDoDesfecho(d, { silenciarRecusa: true });
        if (texto) avisar(texto);
        if (!d.ok && d.motivo === 'sessao') router.replace('/login?voltar=/jogo');
        return d.ok;
      }),
    };
  };

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    mapa.current?.irPara(v === 'vila' ? 'vila' : 'mapa');
  };

  const responderMercador = async (aceitar: boolean) => {
    const pede = mercador ? mercador.paga.map((i) => NOMES_RECURSOS[i.recurso].toLowerCase()).join(' e ') : 'recurso';
    setRespondendo(true);
    const d = await jogo.sinc.enviar({ tipo: 'responder_mercador', aceitar });
    setRespondendo(false);
    setPopupAberto(false);
    // Recusa do servidor com o motivo da troca (a tela já desativa, mas o estado pode ter mudado).
    const texto = !d.ok && d.motivo === 'recusada' && d.erro === 'recursos_insuficientes'
      ? `Falta ${pede} para a troca com o Mercador.`
      : !d.ok && d.motivo === 'recusada' && d.erro === 'sem_mercador'
        ? 'O Mercador já seguiu viagem.'
        : textoDoDesfecho(d);
    if (texto) avisar(texto);
  };

  /** Linhas da Crônica no painel (rolam junto com os cartões). */
  const LINHAS_CRONICA = 8;

  return (
    <main className={estilos.raiz}>
      <Hud
        era={textoEra(visivel.era)}
        chips={chipsHud(visivel)}
        pulso={pulso}
        salvando={salvando}
        aoSalvar={() => void salvarAgora()}
        aoConfigurar={() => setModal({ tipo: 'configuracoes' })}
        aoRanking={() => setModal({ tipo: 'ranking' })}
        aoConstruir={() => abrirCatalogo(null)}
        selo={selo}
        aoPesquisar={() => setModal({ tipo: 'pesquisa' })}
        seloPesquisa={seloPesquisa(visivel)}
        aoDiario={() => setModal({ tipo: 'diario' })}
        novosDiario={novosDiario}
      />
      <FaixaObjetivo texto={passo.principal} novos={novosDiario} aoAbrir={() => setModal({ tipo: 'objetivo' })} aoDiario={() => setModal({ tipo: 'diario' })} />
      <Abas
        ativa={aba}
        aoTrocar={(a) => {
          setAba(a);
          setDestaque(null);
        }}
      >
        <div className={estilos.objetivoAbas}>
          <ChipObjetivo texto={passo.principal} aoAbrir={() => setModal({ tipo: 'objetivo' })} />
        </div>
        <IndicadorSalvo sincronia={sincronia} agoraLocal={Date.now()} />
      </Abas>

      <div className={estilos.areaCaixa}>
      <div ref={conteudo} className={estilos.area} data-layout={celular ? 'celular' : 'normal'}>
        {/* O mapa fica montado nas outras abas (sprites e câmera não recarregam). */}
        <div className={`${estilos.colunaMapa} ${aba === 'vila' ? '' : estilos.oculto}`}>
          <div className={estilos.molduraMapa}>
            <div className={estilos.areaMapa}>
              <CanvasMapa
                estado={visivel}
                relogio={relogio}
                clicarObjeto={clicarObjeto}
                aoEvento={aoEvento}
                depuracao={depuracao}
                controle={mapa}
                mostrarAjuda={false}
                ajustavel
                animado={preferencias.animacoes}
                celular={celular}
              >
                {(cam: Camera, vp: Tamanho) => {
                  /** Mesmo limite do CSS (@container mapa, 600 px): chip compacto, sem zoom nem minimapa. */
                  const estreito = vp.largura <= 600;
                  return (
                    <>
                      {mercador && visao === 'vila' && (!estreito || popupAberto) && (
                        <PopupMercador dados={mercador} enviando={respondendo} aoResponder={responderMercador} animado={preferencias.animacoes} />
                      )}
                      {mercador && (visao === 'reino' || (estreito && !popupAberto)) && (
                        <ChipEvento
                          dados={mercador}
                          aoAbrir={() => {
                            setPopupAberto(true);
                            if (visao !== 'vila') trocarVisao('vila');
                          }}
                        />
                      )}
                      {!(visao === 'vila' && mercador && (!estreito || popupAberto)) && <AlternarVisao visao={visao} aoTrocar={trocarVisao} />}
                      {!celular && <BotaoConstruirFlutuante selo={selo} aoAbrir={() => abrirCatalogo(null)} />}
                      {visao === 'reino' && (
                        <>
                          <ControleZoom zoom={cam.zoom} minimo={zoomMinimoQueCobre(areaDoMapa(mundo), vp)} maximo={ZOOM_MAXIMO} aoZoom={(p) => mapa.current?.zoom(p)} />
                          <Minimapa mapa={mundo} cam={cam} vp={vp} nevoas={nevoasMini} aoCentrar={(p) => mapa.current?.centrar(p)} />
                        </>
                      )}
                    </>
                  );
                }}
              </CanvasMapa>
            </div>
          </div>
        </div>
        {celular && aba === 'vila' && visao === 'vila' && (
          <div className={estilos.abaixoDoMapa}>
            <BotaoConstrucoes selo={selo} aoAbrir={() => abrirCatalogo(null)} />
            <CartaoAldeoes d={dadosAldeoes(visivel)} aoEvento={aoEvento} />
            <CartaoCronica linhas={linhasCronica(visivel, LINHAS_CRONICA)} />
          </div>
        )}
        {celular && aba === 'vila' && visao === 'reino' && (
          <GavetaDestinos
            subtitulo={destinos.titulo}
            destinos={destinos.cartas}
            aoEvento={aoEvento}
            aberta={gavetaAberta}
            aoTrocar={setGavetaAberta}
            animado={preferencias.animacoes}
          />
        )}
        <aside ref={coluna} className={`${estilos.lateral} ${aba === 'vila' && !celular ? '' : estilos.oculto}`}>
          <PainelLateral
            titulo={visao === 'vila' ? 'Construções' : 'Destinos'}
            subtitulo={visao === 'vila' ? construcoes.titulo : destinos.titulo}
            icone={visao === 'vila' ? 'icone-construir' : 'icone-expedicao'}
            construcoes={visao === 'vila' ? construcoes.cartas : undefined}
            aldeoes={visao === 'vila' ? dadosAldeoes(visivel) : undefined}
            destinos={visao === 'reino' ? destinos.cartas : undefined}
            cronica={linhasCronica(visivel, LINHAS_CRONICA)}
            aoEvento={aoEvento}
            rodape={acoesDepuracao}
          />
        </aside>
        {aba === 'herois' && <TelaHerois estado={visivel} agora={agora} acoes={acoesTela} />}
        {aba === 'expedicoes' && (
          <TelaExpedicoes estado={visivel} agora={agora} acoes={acoesTela} selecionados={selecionados} aoSelecionar={setSelecionados} destaque={destaque} />
        )}
        {aba === 'eras' && <TelaEras estado={visivel} acoes={acoesTela} />}
      </div>
      </div>

      {modal?.tipo === 'catalogo' && (
        <Catalogo
          linhas={linhasCatalogoTela(visivel, agora, modal.ordem)}
          foco={modal.foco}
          construindo={construindo}
          aoConstruir={(slot) => void obraPeloCatalogo('construir', slot)}
          aoMelhorar={(slot) => void obraPeloCatalogo('melhorar', slot)}
          aoFechar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'obra' && (
        <ModalObra
          dados={dadosMelhorar(visivel, modal.slot, agora)}
          enviando={false}
          aoFechar={() => setModal(null)}
          aoConfirmar={() => {
            const slot = modal.slot;
            // Prevista: a obra aparece na hora; o modal fecha e o mapa mostra o andaime.
            void enviarPrevista({ tipo: 'melhorar', slot });
            setModal(null);
          }}
        />
      )}
      {modal?.tipo === 'reerguerQg' && (
        <ModalReerguerQg
          dados={dadosReerguerQg(visivel)}
          enviando={acaoServidor.enviando}
          aoFechar={() => setModal(null)}
          aoConfirmar={() => {
            void acaoServidor.executar({ tipo: 'reerguer_qg' }).then((d) => {
              if (d?.ok) {
                setModal(null);
                avisar(TEXTOS_QG.reerguidoCronica);
              }
            });
          }}
        />
      )}
      {modal?.tipo === 'pesquisa' && (
        <ModalPesquisa dados={dadosPesquisa(visivel, agora)} aoPesquisar={(id: PesquisaId) => void enviarPrevista({ tipo: 'pesquisar', pesquisa: id })} aoFechar={() => setModal(null)} />
      )}
      {modal?.tipo === 'configuracoes' && (
        <ModalConfiguracoes
          animacoes={preferencias.animacoes}
          aoTrocarAnimacoes={() => {
            void definir({ animacoes: !preferencias.animacoes }).then((ok) => {
              if (!ok) avisar('Não deu para guardar a preferência na conta.');
            });
          }}
          salvo={textoSalvo(sincronia, Date.now()).texto}
          salvando={salvando}
          aoSalvar={() => void salvarAgora()}
          aoBaixar={() => baixarCopia({ exportadoEm: new Date().toISOString(), aviso: 'Cópia somente leitura do Cronarca.', estado: visivel }, visivel.ciclo)}
          conta={usuario ? { nome: usuario.nome, email: usuario.email, convidado: usuario.convidado } : null}
          aoVincular={() => setModal({ tipo: 'vinculo', retorno: null })}
          sair={<BotaoSair />}
          apagando={apagando}
          aoApagar={(palavra) => void apagarProgresso(palavra)}
          palavraApagar={PALAVRA_APAGAR}
          // Troca de modal (não empilha dois diálogos com foco preso).
          aoRanking={() => setModal({ tipo: 'ranking' })}
          aoFechar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'ranking' && (
        <ModalRanking eraDoJogador={visivel.era} convidado={eConvidado} aoVincular={() => setModal({ tipo: 'vinculo', retorno: null })} aoFechar={() => setModal(null)} />
      )}
      {modal?.tipo === 'vinculo' && usuario && (
        <ModalVinculo
          usuario={usuario}
          retorno={modal.retorno}
          aoConcluir={() => {
            setModal(null);
            avisar('Conta vinculada. Seu reino entra no ranking.');
          }}
          aoFechar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'objetivo' && (
        <ModalObjetivo
          passo={passo}
          aoEras={() => {
            setModal(null);
            setAba('eras');
          }}
          aoFechar={() => setModal(null)}
        />
      )}
      {modal?.tipo === 'diario' && (
        <ModalDiario linhas={linhasDiario(visivel, lidos)} aoAbrir={abrirCapitulo} aoPrologo={() => setModal({ tipo: 'prologo' })} aoFechar={() => setModal(null)} />
      )}
      {modal?.tipo === 'prologo' && <ModalPrologo aoFechar={fecharPrologo} />}
      {confirmacao.pedido?.tipo === 'ascender' && (
        <ModalAscensao dados={dadosAscensao(visivel)} enviando={false} aoConfirmar={() => confirmacao.responder(true)} aoFechar={() => confirmacao.responder(false)} />
      )}
    </main>
  );
}
