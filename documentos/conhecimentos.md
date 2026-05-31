# Base de Conhecimentos e Lições Aprendidas

Neste arquivo registraremos todos os erros cometidos durante o desenvolvimento e os testes do jogo, bem como a forma correta de resolver cada um, servindo de memória contínua para evitar repetições.

## Lista de Erros e Correções

### 1. Concorrência na Fila de Construção (Race Condition)
**Erro:** O endpoint `/village/build` permitia o processamento simultâneo de requisições se disparadas muito rápido (múltiplos cliques). Isso deduzia os recursos várias vezes para o mesmo nível de upgrade.
**Correção:** É necessário envolver a verificação e a dedução de recursos em um `$transaction` (Prisma) ou verificar rigorosamente o status imediato, embora transações com isolamento sejam a forma correta, o Prisma usa um bloqueio leve no findUnique. Em cenários reais, devemos garantir lock na linha da vila ou conferir na mesma query atômica (ex: `update` com `where: { wood: { gte: custo } }`).

### 2. Congelamento Visual de Interface Pós-Erro
**Erro:** Na `TelaAldeia`, caso a API negue uma requisição com erro `400 Bad Request` por concorrência e falha de recursos, o bloco `catch` não solicita a sincronização `buscarAldeia()`. Isso pode fazer com que os cálculos locais fiquem travados.
**Correção:** É sempre recomendado forçar um `buscarAldeia()` ou sincronismo de estado da interface até mesmo dentro do bloco `catch` ou `finally` caso a requisição altere o fluxo temporal dos dados.
