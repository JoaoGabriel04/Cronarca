# Prompt: Portão 7 aprovado com mudança, executar o Portão 7b

O Portão 7 ficou bom como base (câmera, grade, renderizador de tiles), mas o mapa copiado do Figma é pequeno, tem uma estrada reta e um cruzamento só, e as bordas das zonas de terreno ficaram secas. Decisão do dono: **o mundo passa a ser gerado por semente, diferente a cada ciclo**, maior, com estradas e rio variados e transições de terreno com degradê. O jogador não desenha nada, o centro da vila continua fixo.

Antes de começar:

1. Substitua os arquivos de `docs/` pelos novos (`CRONARCA_HANDOFF.md`, `CRONARCA_MAPA_SPEC.md`, `CRONARCA_MUNDO_SPEC.md` e a pasta `docs/referencia/`) e releia `CLAUDE.md`.
2. Leia `docs/CRONARCA_MUNDO_SPEC.md` inteira. Ela prevalece sobre a spec do mapa em terreno, rio, estrada, zonas, destinos e névoa. A imagem `docs/referencia/galeria_mundos_prototipo.png` mostra o resultado esperado (protótipo em Python; você implementa em TypeScript).
3. Sprites novos no Figma (arquivo `e6AYbKy8d1uUd5gIYC857u`, página Sprites, somente leitura): `Sprite/Transicao` (Borda, Canto, Canto Interno, variantes 1 a 5) e, dentro de `Sprite/Nevoa`, a variante nova `Nevoa Canto Interno`. Os antigos `Pantano Borda` e `Pantano Canto` saem de uso.

Execute só o **Portão 7b**, na ordem:

- Primeiro, me mande um relatório curto: o que vai mudar no código existente do Portão 6 e 7, conflitos ou lacunas que você achar na spec do mundo (por exemplo, algo que o algoritmo da seção 3 não decide), e riscos. Espere meu "pode seguir".
- Depois do "pode seguir": `gerarMundo` e tipos no `game-core` com os testes da seção 5; renderizador lendo do `Mundo` (L0, L0b, L1 a L3, L6); parâmetro `?semente=NNN` e botão "Nova semente" na página de preview; `estado.mundo` no esquema; script que gera a galeria de 12 sementes.
- Pare ao terminar, entregue a galeria e os comandos de verificação, e espere minha aprovação visual antes do Portão 8.

Lembretes: sem `Math.random` nem `Date` no gerador, versão do gerador nunca muda depois de publicada, tudo que é número fica em constantes ou dados, e dúvida de regra é pergunta, não invenção.
