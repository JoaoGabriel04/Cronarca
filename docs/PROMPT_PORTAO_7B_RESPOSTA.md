# Resposta ao relatório do Portão 7b

Ótimo relatório. Decisões:

1. Estrada do núcleo: você tem razão, erro meu de conta. É a coluna 18 (a linha 13 bate). Corrigido na spec.
2. Caixa da cripta a 2 tiles ou mais do núcleo: aprovado.
3. Teste do núcleo confere só o que é gerado. Os prédios cobrindo alguns pixels da estrada já existem no design, ficam como estão. Não alinhar slots a grade de 8 agora.
15. VERSAO_ESQUEMA 2, sem conversor, use `make reset-db`. Semente só no jsonb, validada pelo Zod.
4 a 14 e 16: aceitos exatamente como você propôs. Estão registrados na seção 7 de `docs/CRONARCA_MUNDO_SPEC.md` (arquivo atualizado, substitua o anterior).

Risco dos sprites: confirme a transparência antes de usar (SVG convertido, comparado com a exportação do plugin). Se `Sprite/Transicao` ou `Sprite/Nevoa` não saírem limpos, me avise que eu forneço os PNGs com alfa.

Versão do gerador congelada só depois da minha aprovação visual da galeria. Pode seguir com o Portão 7b, testes da seção 5 primeiro.
