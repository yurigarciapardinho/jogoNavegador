# Base de Conhecimento Técnica - TW2 Clone

Este documento constitui a visão absoluta, 100% fática e validada da arquitetura e do código-fonte do motor de jogo TW2 Clone. Baseado integralmente na leitura estrita e direta da base de código (Backend em Node.js/Fastify e Frontend em React/Vite/PixiJS).

---

## 1. Arquitetura e Padrões Globais
O sistema opera em um modelo Monorepo, com forte separação de responsabilidades e adesão ao **Padrão YGP (Yuri Garcia Pardinho)**, focado em clareza, nomes em português usando `camelCase`, simplicidade extrema e validações explícitas sem bibliotecas excessivas.

- **Backend (Fonte da Verdade):** Desenvolvido em Node.js com o framework **Fastify** para lidar com APIs RESTful e **Prisma ORM** como interface de acesso ao **PostgreSQL**. A segurança de rotas é tratada com tokens state-less via `@fastify/jwt` (com injeção `request.user`).
- **Frontend (Visualização):** SPA (Single Page Application) baseada em **React** com bundle via **Vite**. Todo o gerencimento de estado global (recursos, token de sessão, usuário logado, fluxos de tela e notificações) é centralizado pelo **Zustand**. A renderização do mapa utiliza o motor **PixiJS v8**, que aplica fallback automático para WebGPU/WebGL/Canvas.

---

## 2. Modelagem do Banco de Dados (Schema Prisma)
O núcleo do ecossistema reside nas seguintes entidades relacionais:
- **`User`**: A conta do jogador, possuindo um identificador único, nome, e-mail, hash da senha (`bcrypt`), flag de derrota (`isDefeated`) e cargo (`Role` enum: `PLAYER` ou `ADMIN`).
- **`Village`**: O ponto fundamental do jogo no mapa. Cada aldeia possui uma coordenada única (`x`, `y`), relação (ou não) com um `User`, e é a raiz das extensões `VillageResource`, `VillageBuilding` e `VillageUnit`.
- **`VillageResource`**: Armazena madeira, argila e ferro, e o `lastUpdate` para cálculo passivo de produção offline.
- **`VillageBuilding`**: Guarda os níveis de Sede (Headquarters), Bosque (timberCamp), Poço de Argila (clayPit), Mina de Ferro (ironMine), Fazenda, Armazém, Quartel, Muralha e Igreja.
- **`VillageUnit`**: Mantém o número absoluto das tropas nativas (Lanceiro, Espadachim, Machado/Bárbaro) atreladas e paradas na aldeia.
- **Filas (`BuildingQueue` e `UnitQueue`)**: Registram os processos em andamento, como evolução de níveis e recrutamento. Guardam as chaves `startTime`, `endTime` e o booleano `completed`.
- **`Movement`**: Unifica os despachos (Ataque, Apoio, Retorno) no mapa. Possui coordenadas da origem e do alvo, tropas em viagem, data de chegada, e espólio saqueado em caso de retorno.
- **`SupportingTroop`**: Apenas para registrar tropas de apoio que chegaram pacificamente e estão ociosas na vila-alvo ajudando em defesas futuras.
- **`CombatReport`**: Relatórios históricos fixos com sumário estatístico de tropas enviadas vs perdas, saque e ganhador de uma batalha concluída.
- **`AdminLog`** e **`ServerConfig`**: Trilhas de auditoria das ferramentas do Administrador (Nuke, alteração de recursos) e as configs globais (Speed Multiplier do servidor, Manutenção e Mensagem Global).

---

## 3. Lógica Fundamental (Backend Game Engine)

### 3.1 Geração de Mundo (Spawn)
A alocação das aldeias ocorre no arquivo `spawn.ts`.
- O cálculo gera coordenadas em formato circular baseado em **Anéis Concêntricos** a partir do centro (500, 500), estendendo-se do raio 3 ao raio 500.
- Evita justaposições checando de forma iterativa as proximidades (-2 a +2 blocos).
- Quando um novo jogador cadastra e é gerada sua Sede, o sistema programa o spawn dinâmico assíncrono de uma **Aldeia Bárbara** (`userId: null`) nas proximidades (via `setTimeout`), ajudando a popular o cenário.

### 3.2 Motor Econômico (Edifícios e Recursos)
- Custos exponenciais para edifícios: Fórmula exata `CustoAtual = CustoBase * (1.2 ^ (NívelAlvo - 1))`.
- Produção passiva por hora calculada dinamicamente: Ao acessar a aldeia, a rota pega a diferença em horas (entre `agora` e `lastUpdate`), multiplicada por `300 * speedMultiplier * nivelPredio` de cada mina/bosque e incrementa o recurso estático sem um cronjob pesado em background.
- Para evitar **Condição de Corrida (Race Condition)** em múltiplos cliques do Frontend para evoluir, as deduções de recursos usam o Prisma `$transaction` integrado a consultas com bloqueio por `FOR UPDATE` e deduções com garantias matemáticas `{ decrement: valor }`. Falhas explodem erros `INSUFFICIENT_RESOURCES`.

### 3.3 Motor Militar (Tropas e Combate)
- As tropas estão agrupadas em três classificações fixas:
  - **Lanceiro (Spear)**: Defesa contra cavalaria (embora cavalaria não esteja implementada no MVP) e saque, Ataque: 10, Defesa: 15, Carga: 25.
  - **Espadachim (Sword)**: Foco defensivo pesado, Ataque: 25, Defesa: 50, Carga: 15.
  - **Machado (Axe/Bárbaro)**: Foco ofensivo, Ataque: 40, Defesa: 10, Carga: 10.
- **Velocidade de Treinamento**: Pode ser otimizada pelo Quartel com a equação de redução progressiva `0.95 ^ (NívelQuartel - 1)`.
- **Combat Loop**: O motor de combate roda isoladamente em um processo independente (`worker.ts`) que invoca o loop (`combatLoop.ts`) num `setInterval` a cada 2 segundos. Ele puxa do banco todos os `Movement` pendentes que atingiram ou passaram o `arrivalTime` no relógio e julga as consequências.
- **Cálculo da Batalha (`calculateCombat`)**:
  - Acumula total de Ataque Atacante e Total de Defesa (Defensor original + `SupportingTroops` se houver).
  - Vencedor = Maior Poder. O percentual de mortalidade de um grupo é calculado pela equação implacável: `(PoderAdversario / MeuPoder) ^ 1.5`, com máximo fixo de perda de 100%. O grupo vencedor ainda perde parte proporcional das tropas.
  - Caso o atacante saia vivo, o saldo do saque obedece ao limite de carga que sobrou.
  - Inovação (TW3): Caso o perdedor seja uma Aldeia Bárbara (NPC), a aldeia soma +1 no contador de surras. Ao atingir o limite de 3 ataques tomados, ela evolui os próprios poços em 1 nível, auto-balanceando as recompensas passivas no jogo.

### 3.4 Administração e Controle Global
A rota `admin.ts` exige que o `role` do token decodificado seja `ADMIN`. Permite:
- Alterar saldo arbitrário de tropas e recursos num jogador sem transações matemáticas.
- **Wipe Remoto Absoluto**: O endpoint `/admin/db/wipe` deleta todo o banco relacional usando `deleteMany` (tabela a tabela para evitar falha de constraints) limpando inclusive todos os jogadores, retendo apenas o ID do Admin que executou o comando.
- Modificar o `SpeedMultiplier` (afetando o tempo de movimento, produção e construção instantaneamente para o cálculo futuro) e habilitar o modo de manutenção global.

---

## 4. Frontend Web (Motor Visual PixiJS e Lógica UI)

### 4.1 Interface React (Mecânica e Navegação)
- Não utiliza bibliotecas pesadas de rotas. O mapeamento do aplicativo é um "Switch" no `App.tsx` que alterna os componentes (`TelaAldeia`, `TelaMapa`, etc) com base na flag `telaAtual` do store Zustand.
- Respostas da API passam pelo interceptor `api.ts`, traduzindo erros semânticos (401, 500) para strings amigáveis processadas pela notificação Toast via `GerenciadorNotificacoes.tsx`.
- Caso o usuário seja conquistado ou aniquilado (`isDefeated`), a interface trava numa `TelaDerrota.tsx`, onde ele perde acesso ao mapa e aos relatórios, tendo unicamente um botão pedindo ao servidor um novo spawn geográfico via `/me/restart`.

### 4.2 Motor WebGL/WebGPU (PixiJS v8 - `MotorMapa.ts`)
- O mapa da tela Web foi erguido obedecendo os paradigmas modernos de inicialização assíncrona do PixiJS 8+ (`await app.init()`). O "Load ImageBitmap" foi deliberadamente desativado no topo (`Assets.setPreferences({ preferCreateImageBitmap: false })`) para prever crashes no Fallback.
- **Chunking (Carga Sob Demanda)**: Para preservar a RAM e impedir que as milhares de coordenadas sejam injetadas ao mesmo tempo, a classe `MotorMapa` possui um monitor no loop `ticker.add()` limitando requisições REST ao backend (via bbox: minX, maxX) atrelado à posição e movimento da Câmera Arrastável (Panning Mouse Pointer).
- **Processamento Procedural**: Ao invés de dependências com milhares de Sprites, o cenário base é um material gerado programaticamente (2x2 rects Graphics) convertido em textura rasterizada injetada num `TilingSprite`.
- O Rastreio das animações e interpolação linear (`Math.hypot`, progresso do `agora - start` vs `arrival`) funciona dinamicamente, gerando bolinhas sobrepostas por Emojis textuais em fontes nativas do Canvas. Os rastros (Linhas Pontilhadas/Tracejadas) são repintados e re-apagados matematicamente a cada frame no Ticker, indicando a trajetória de saída até o alvo.

---

Este documento serve a partir deste momento como referencial incontestável do ambiente de execução do TW2 Clone e base técnica oficial de trabalho, isento de palpites, deduzido diretamente da estrutura real implementada nas classes.
