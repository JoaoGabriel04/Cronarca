# Prompt inicial para o Claude Code

Cole o texto abaixo no Claude Code, aberto na pasta `cronarca/`.

---

Você vai implementar o Cronarca, um jogo web incremental medieval. Antes de qualquer coisa, leia por inteiro, nesta ordem:

1. `CLAUDE.md`
2. `docs/CRONARCA_HANDOFF.md`
3. `docs/CRONARCA_MAPA_SPEC.md`

Se o conector do Figma estiver disponível, abra o arquivo "Cronarca - Telas" (fileKey `e6AYbKy8d1uUd5gIYC857u`), página `Telas v2`, e olhe os frames citados no handoff. Não altere nada no Figma.

Esta primeira tarefa é só o **Portão 0**. Não crie nem edite nenhum arquivo do projeto. Responda com um relatório em português, com estas partes:

1. **O que entendi:** resumo em até 15 linhas do jogo, da arquitetura (servidor autoritativo, liquidação por tempo, ações como comandos) e dos portões.
2. **Conflitos e lacunas:** qualquer contradição entre os documentos, regra que faltou, número sem origem ou decisão que o handoff deixa em aberto. Para cada item, diga o que você assumiria e por quê.
3. **Riscos técnicos:** os três maiores riscos da arquitetura (por exemplo: precisão da liquidação por tempo, concorrência de ações, hitbox do clique) e como o plano os trata.
4. **Estrutura proposta:** árvore de pastas do monorepo, serviços do `docker-compose.yml` e targets do `Makefile` do Portão 1, só como texto.
5. **Plano do Portão 1:** lista numerada do que você criaria, na ordem, e como eu confirmo que funcionou (`make up`, healthchecks, URLs).

Regras para toda a sessão:

- Siga os portões do handoff, um por vez. Depois de entregar um portão, pare e espere eu escrever "pode seguir" antes de começar o próximo.
- Não adiante trabalho de portões futuros, não faça commit nem push sem eu pedir.
- Se algo for ambíguo (regra de jogo, escala de sprite, layout), pergunte em vez de inventar.
- O servidor é a autoridade: o cliente nunca envia quantidades nem resultados.
- Fórmulas e números ficam em arquivos de dados do `game-core`, nunca espalhados no código.
- Interface sem emojis; use os sprites de ícone ou Lucide React. SWR nos GET do front.

Quando terminar o relatório do Portão 0, pare e espere minha aprovação.
