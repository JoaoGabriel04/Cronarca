# Arte do Portão 23 (comigo): lista e estado

Formato: PNG RGBA 32 px (personagens) ou 16/32 px (efeitos), contorno escuro, escala inteira no jogo, `image-rendering: pixelated`. Lado: personagens olham para a direita; o inimigo é o espelho horizontal no canvas.

| Item | Tamanho / quadros | Estado |
|---|---|---|
| Eco (inimigo) das 4 classes, idle 6 quadros | 32 px | PRONTO (eco_lanceiro, eco_cavaleiro, eco_mago_do_tempo, eco_arqueiro) |
| Ataque por classe (4 quadros) | 32 px | lote 1 |
| Golpe recebido por classe (2 quadros) | 32 px | lote 1 |
| Queda por classe (4 quadros) | 32 px | lote 1 |
| Versão Eco de ataque, golpe e queda | 32 px | lote 1 |
| Projéteis: flecha (2), orbe do Mago (3) | 16 px | lote 1 |
| Efeitos do Mago: atraso (4), pressa (4) | 32 px | lote 1 |
| Cenários por tema (clareira, ruínas, pântano, cripta, ponte, floresta sombria) com tamanhos pequeno a enorme | composição | lote 2 |
| Chefes (a cada 10 fases), sprite maior | 64 px | lote 3 |
| Ícones: tema, dificuldade (5 níveis), butim, Fragmento de Tempo no HUD | 16 px | lote 3 |
| Barra de vida e números de dano | CSS/fonte | com o Claude Code (sem sprite) |

Nota de método: quadros de ataque, golpe e queda são derivados dos sprites existentes por deslocamento, brilho e compressão vertical (sem rotação), para manter o pixel limpo e a identidade de cada classe.
