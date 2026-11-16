# PROMPT — Tela inicial v2 (Opção 1: usar SÓ os sprites que já existem)

Contexto: redesenho de Início/Login. Referência visual: Figma, página "Telas v2", frames "Início - Desktop/Mobile" e "Login - Desktop/Mobile". Tudo documentado em docs/.

## Regras (valem para todos os portões)
1. Nada é escrito sem aprovação explícita do Gabriel ao final de cada portão.
2. LISTA FECHADA de sprites permitidos nas cenas Início/Login:
   - `public/sprites/cena/pinho0_*.png`, `pinho1_*.png` (48x48; ESCALAS inteiras 2x longe, 3x médio, 6x perto)
   - `public/sprites/cena/cavaleiro_*.png`, `fogueira_*.png`, `flores_*.png`, `placa_*.png`
   - `public/sprites/cenario/cerca_*.png`
   - castelo NOVO: `public/sprites/cena/castelo_1..8.png` (96x96, 8 quadros, bandeiras balançando) — arquivos entregues em `cena/out/castelo_1-8.png`
   - fundo: `fundo_inicio.png` (240x150) -> `public/cenas/inicio.png`, usado também no Login
3. PROIBIDO criar, redesenhar ou usar qualquer outro sprite. Os sprites redesenhados por mim (pacote cena_v2_sprites) NÃO entram, exceto castelo e fundo.
4. SVGs antigos NÃO são usados: castelo, cavaleiro, fogueira, placa (mortos) e pinheiro, flores, cerca, arbusto (migrar para PNG). Mantém só `icone-config` e `icone-saber` (ícones de UI).
5. Arbusto não aparece no layout novo; remover do dados.ts se nenhum outro lugar usar.
6. Mapa (public/mapa/arvores) não é tocado.

## Portão 0 — Auditoria (somente leitura)
- Confirmar que cada arquivo da lista fechada existe e listar tamanho/quadros.
- Listar todo uso de SVG antigo (`/sprites/*-1.svg`, `-2.svg`) em Cena.tsx, dados.ts, CSS e testes.
- Confirmar onde `SPRITES_COM_QUADROS` e as durações são definidas (fonte única).
Entregar relatório. Aguardar aprovação.

## Portão 1 — Plano
Plano de arquivos a mudar, tabela de posições (abaixo), como pinho0/pinho1/flores/cerca/placa entram em SPRITES_COM_QUADROS com durações vindas de uma fonte única (quadros_cena.json). Aguardar aprovação.

## Portão 2 — Assets
- Copiar castelo_1..8.png para `public/sprites/cena/` e fundo para `public/cenas/inicio.png`.
- Registrar no manifesto/quadros_cena.json: castelo 8 quadros, pinho0/pinho1, flores, cerca, placa.
- Nenhuma imagem nova além das duas acima. Aguardar aprovação.

## Portão 3 — Integração
Posições (px de tela 1440x900; escala = múltiplo inteiro, `image-rendering: pixelated`):

Início Desktop
| sprite | x | y | tamanho |
|---|---|---|---|
| pinho 2x (longe) | 8 + i·56 (i=0..7), alternando pinho0/pinho1 | 470 (+4 nos ímpares) | 96 |
| pinho 2x (longe, direita) | 1000 + i·56 (i=0..7) | 470 (+4 ímpares) | 96 |
| pinho 3x (médio) | pinho1 (230,506); pinho0 (376,494); pinho0 (1010,504) | | 144 |
| pinho 6x (perto) | pinho0 (-30,428); pinho1 (1250,436) | | 288 |
| castelo | 528,222 | | 384 (4x) |
| cavaleiro | 14,590 | | 192 |
| fogueira | 120,690 (fora da estrada) | | 192 |
| flores | (1000,730), (1330,780) | | 96 |
| cerca | (1150,744), (1246,744), (1342,744) | | 96 |
| placa | 1242,600 | | 192 |

Login Desktop: mesmos pinhos, castelo, cavaleiro e fogueira (sem flores/cerca/placa); card em 940,72.

Início Mobile (390x844): castelo (3,150) 384; pinho 3x (-50,420) e (296,430) 144; cavaleiro (10,556) 96; fogueira (118,564) 96; flores (290,590) e (330,610) 48. Menu em y=650.
Login Mobile: cabeçalho 424 com castelo (3,62) 384.

Ordem de camadas: fundo, pinhos longe/médio, castelo, pinhos perto, personagens e objetos, texto, menu.
Animação: SpriteAnimado para todos os que têm quadros; castelo 8 quadros com durações do quadros_cena.json. Aguardar aprovação.

## Portão 4 — Limpeza, testes e prova
- Remover SVGs listados na regra 4 e as referências em Cena.tsx/dados.ts.
- Testes: falham se qualquer `*.svg` de sprite for referenciado na cena; falham se a cena renderizar sprite fora da lista fechada.
- Screenshots Início/Login desktop e mobile lado a lado com o Figma; relatar diferenças.
- Documentar em docs/ (decisão: Opção 1, castelo novo + fundo_inicio + sprites existentes).
