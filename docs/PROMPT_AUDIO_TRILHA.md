# PROMPT: ambiente de áudio e trilha sonora (preparar, sem publicar a música)

Regra geral: NADA é escrito, commitado ou deployado sem aprovação explícita do Gabriel no fim de cada gate. Gate 1 é somente leitura. Registre no registro de portões SÓ ACRESCENTANDO ao fim.

## Contexto
O Gabriel gerou uma trilha instrumental medieval calma no Suno, no plano GRÁTIS (sem direitos comerciais). Essa faixa é só protótipo: NÃO pode ser commitada nem publicada em produção. O objetivo é deixar o jogo pronto para tocar música quando ele tiver faixas liberadas.

## Requisitos
1. Música controlada por um módulo (hook/provider) no frontend, sem tocar nada por padrão se não houver arquivo.
2. Configurações (modal já existente): interruptor de música, controle de volume, mudo. Preferência guardada no dispositivo (localStorage com try/catch); conta convidada incluída.
3. Respeitar a política de autoplay dos navegadores: só começa após a primeira interação do usuário. Pausar quando a aba ficar oculta e retomar ao voltar. Fade de 1 a 2 s ao entrar, sair e trocar de faixa.
4. Loop sem emenda audível: avaliar HTMLAudioElement com loop versus Web Audio API (buffer), e recomendar o que não deixa falha no ponto de repetição, considerando mp3 e ogg.
5. Configuração das faixas em dados (data/musica.ts ou JSON): id, arquivo, volume, loop, e a quais telas/estados se aplica (por enquanto uma faixa única global; o encaixe por tela fica pronto para depois: vila, expedição, noite, ruínas, eras).
6. Carregamento preguiçoso (não pesar o primeiro carregamento), formato e orçamento de tamanho por faixa (proposta: até 3 MB, 128 kbps).
7. Variável de ambiente NEXT_PUBLIC_MUSICA (desligada por padrão). Sem arquivo ou com a variável desligada, nenhum controle de música aparece.
8. Ícones Lucide (Music, Volume2, VolumeX); sem emojis. Testes de unidade da lógica; teste manual em desktop e celular (iOS Safari incluso).
9. A pasta de áudio deve ficar fora do Git por enquanto (.gitignore em public/musica/ para arquivos de áudio), com um README explicando a licença.

## Gate 1: auditoria e proposta (somente leitura)
Leia o modal de Configurações, onde preferências do usuário são guardadas hoje, a estrutura do Next (app router/providers), e proponha: arquitetura do módulo, local dos arquivos, API do hook, UI no modal de Configurações, estratégia de loop, plano de testes e riscos (autoplay no iOS, bateria, dados móveis). Pare e aguarde aprovação.

## Gate 2
Implementar conforme aprovado, usando um tom de teste gerado no próprio teste (não a faixa do Suno). Sem commit/push/deploy sem aprovação.
