# Cronarca

Jogo web incremental (idle) medieval, com eras (I Aldeia, II Reino, III Arcana, IV Dimensões), mapa como área principal do jogo, ascensão com relíquias e ranking. O jogador só joga logado e o servidor é a autoridade do estado do jogo.

## Onde está a verdade

- `docs/CRONARCA_HANDOFF.md`: stack, arquitetura, dados do jogo, fórmulas v0, esquema do estado, portões de aprovação e componentes de interface.
- `docs/CRONARCA_MAPA_SPEC.md`: unidades, câmera, tabela de escala, camadas, tiles, slots de construção, mobile.
- `docs/CRONARCA_MAPA_GRANDE.md`: mapa grande fixo e pré-renderizado (A13). Prevalece sobre a spec do mapa em terreno, rio, estrada, zonas, destinos e névoa.
- `docs/CRONARCA_MUNDO_SPEC.md`: **histórico**, cancelado pela A13 (mundo por semente).
- Design no Figma, arquivo "Cronarca - Telas" (fileKey `e6AYbKy8d1uUd5gIYC857u`): páginas `Telas v2` (telas e modais), `Sprites`, `Componentes`. A página `Telas` é a versão antiga, só consulta.

Se algo aqui contradisser os documentos acima, valem os documentos. Se os documentos se contradisserem entre si, pare e pergunte.

## Fluxo de trabalho (obrigatório)

1. Trabalhe por portões, na ordem do handoff. Antes de cada portão, audite o que existe, liste o que vai criar ou mudar e espere aprovação explícita ("pode seguir").
2. Não escreva arquivos fora do portão aprovado e não adiante portões seguintes.
3. Cada portão termina com uma entrega pequena e verificável, com os comandos para conferir (`make up`, `make test`).
4. Não faça commit nem push sem eu pedir.
5. Em caso de dúvida de regra de jogo, de escala ou de layout, pergunte em vez de inventar.

## Stack

Docker Compose + `Makefile`, PostgreSQL, Node + Express + TypeScript + Prisma + Zod, Next.js (App Router) + TypeScript, SWR para GET no front (não usar TanStack Query), login com e-mail e senha, Google e Discord, avatar no Cloudinary, GSAP para animações de interface, mapa em Canvas 2D, pacote compartilhado `game-core`, testes com Vitest. Monorepo com workspaces: `packages/game-core`, `apps/backend`, `apps/frontend`.

## Regras de código e produto

- O servidor decide: o cliente envia intenções e ids, nunca quantidades ou resultados.
- Números de economia ficam em arquivos de dados (`packages/game-core/data`), nunca no código.
- Pixel art: `image-rendering: pixelated`, zoom sempre inteiro, nunca esticar sprite. Tamanhos só pela tabela de escala da spec.
- Sem emojis na interface. Ícones dos sprites (`Sprite/Icone`) ou Lucide React.
- Textos do jogo em português do Brasil.
- TypeScript estrito, validação com Zod em toda entrada de API, senhas com bcrypt, sessão em cookie httpOnly.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
