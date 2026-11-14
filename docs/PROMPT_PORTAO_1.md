# Prompt: aprovar o Portão 0 e executar o Portão 1

Portão 0 aprovado. Seu relatório foi muito bom. Todas as respostas estão no handoff atualizado, na seção "Decisões do Portão 0, rev 2" (conflitos A1 a A11, economia v0, eventos, pesquisas, expedições, estado inicial, e os riscos técnicos aprovados com o acréscimo de simulação em inteiros). Onde algo discordar dessa seção, ela vence. A spec do mapa também foi corrigida (Lápide 12, Mina e Pântano bloqueados, Cripta liberada por Estradas Reais, exceção do mobile).

Antes de começar, releia `docs/CRONARCA_HANDOFF.md` e `docs/CRONARCA_MAPA_SPEC.md` (foram substituídos).

Agora execute só o Portão 1, com a estrutura e o plano que você propôs (npm workspaces, 4 serviços com healthcheck, bind mount e volume nomeado para node_modules, Makefile com migrate e seed avisando "disponível a partir do Portão 2"). Ao terminar, entregue com a saída dos comandos de verificação (`make up`, `make ps`, os dois curl, `make test`, `make down` e `make up` de novo) e pare para minha aprovação antes do Portão 2.
