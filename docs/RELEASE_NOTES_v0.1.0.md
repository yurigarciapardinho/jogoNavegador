# ⚔️ K.A.S.T. - Pre-Alpha v0.1.0: "A Fundação das Terras"

**Data de Lançamento:** Junho de 2026
**Fase de Desenvolvimento:** Pre-Alpha (MVP)

Sejam bem-vindos à primeira versão jogável de **K.A.S.T. (Kommuna de Aliança e Soberania das Terras)**! Esta build marca a consolidação da infraestrutura principal do nosso motor de jogo em tempo real. Erguemos as fundações, afinamos os cálculos matemáticos do backend e agora entregamos o controle das terras a vocês.

Abaixo, detalhamos todos os recursos que já estão integrados e funcionais nesta versão pioneira.

---

## 🏰 Mecânicas Principais (Core Gameplay)

### 1. Sistema de Progressão e Edificações
O coração da sua aldeia pulsa. Você já pode gerenciar e evoluir as edificações vitais do seu império:
- **Edifício Principal (Sede):** O cérebro da vila. Níveis mais altos reduzem o tempo de construção de outros edifícios e desbloqueiam a árvore tecnológica.
- **Economia e Armazenamento:** Bosque (Madeira), Poço de Argila, Mina de Ferro e Armazém gerenciados em tempo real com multiplicadores dinâmicos baseados no nível.
- **Fazenda:** Controle de população estruturado. Recrutar tropas e erguer muros consome suprimentos.
- **Quartel:** Desbloqueado com a Sede no nível 3. Permite o treinamento de seu exército ofensivo e defensivo.
- **Mercado:** Desbloqueado com a Sede no nível 3 e Armazém no nível 2. Essencial para despachar recursos para suas outras aldeias ou aliados.
- *Sistema de Filas de Construção e Recrutamento totalmente funcional e processado pelo servidor de forma assíncrona.*

### 2. O Motor Gráfico de Mapa (Pixi.js)
O mapa mundial não é apenas um JPEG estático, mas sim um motor renderizado via WebGL!
- Navegação fluida com Drag & Drop (Arraste) e Zoom via scroll do mouse.
- **Feedback Visual de Movimentação:** Exércitos viajando pelo mapa desenham trajetórias tracejadas coloridas (Vermelho para Ataques, Azul para Apoio, Verde para Mercado), e uma bolinha desliza sobre a linha mostrando a posição exata das suas tropas em tempo real.
- Atalho rápido (`Space` ou `Barra de Espaço`) para focar a câmera magicamente de volta à sua aldeia ativa.

### 3. Exército, Movimentação e Guerra
- **Unidades Lançadas:**
  - **Lançador:** A espinha dorsal da defesa inicial.
  - **Espadachim:** Muralha defensiva lenta e barata.
  - **Bárbaro:** Sua principal força bruta para rasgar as defesas inimigas.
- **Matemática de Combate Avançada:** O combate avalia estatísticas de ataque ofensivo, defesa contra infantaria, perdas proporcionais, e roubo automático de recursos (Saque) se você for o vencedor.
- **Velocidade Dinâmica:** O tempo de viagem é rigorosamente calculado usando a velocidade base da sua unidade mais lenta dividida pelo multiplicador de velocidade global do servidor.

### 4. Proteção de Iniciante (Escudo Divino) 🛡️
Um HUD moderno e flutuante foi adicionado à parte inferior do jogo:
- A sua primeira aldeia nasce com um micro-escudo de 15 minutos para você entender a interface.
- A sua **Segunda Aldeia** recém-conquistada é abençoada com **14 Dias de Escudo**.
- **Regra de Ouro:** Ninguém pode te atacar enquanto o escudo estiver ativo. No entanto, se você demonstrar agressividade e atacar outro jogador humano, seu escudo se quebra instantaneamente.

### 5. O Sistema de Missões e Expansão
O "Painel de Missões" agora dita o ritmo do tutorial e do early-game:
- Sequência encadeada lógica (Bosque -> Poço -> Ferro -> Sede -> Quartel).
- Recompensas instantâneas para incentivar a progressão.
- **Expansão Dinâmica:** A última missão recompensa você fundando de forma automática a sua **Segunda Aldeia**. O backend varre o mapa num raio de 5 hexágonos de distância e encontra o lugar perfeito para sua nova vila nascer.

---

## ⚡ HUD e Qualidade de Vida (QoL)
- **Barra de Efeitos Ativos (Bottom UI):** O estado da sua vila fica estampado na sua tela. Você verá em tempo real o cronômetro do seu Escudo descendo, multiplicadores de recurso (Booster Iniciante) e se o servidor inteiro está sob o "Acelerador de Administrador".
- **Comutação de Aldeias:** Donos de impérios já podem alternar entre a Aldeia Primária e a Secundária segurando `Shift + Setas` diretamente do teclado.
- **Gestão de Perdas Totais:** Perdeu sua última aldeia na guerra? Uma tela de "Derrota" interativa foi adicionada (embora você não queira vê-la).

---

## 🛠️ Ferramentas Divinas (Modo Administrador)
O Painel de Administração não foi esquecido e recebeu a "Mesa de Guerra":
- Controle mestre da Velocidade do Servidor (`speedMultiplier`).
- Console de Mensagem Global (Anúncios vermelhos que travam na tela de todos).
- **God Mode no Mapa:** Um checkbox que transforma você num Deus. Ative-o e você poderá clicar e arrastar qualquer aldeia do mapa e soltá-la em novas coordenadas.
- Opção para Invocação Instantânea de Aldeias Bárbaras e Deleção Absoluta de jogadores.

---

## 🚧 O que esperar do Alpha? (Próximos Passos)
O motor base está em pé. O próximo grande marco será:
- Criação e Gestão de Tribos (Guildas).
- Unidades de Cavalaria e Máquinas de Cerco (Catapultas e Aríetes).
- Edifícios avançados (Ferreiro, Muralha, Esconderijo).
- O Nobre (Para a conquista tradicional de aldeias).

*Preparem suas táticas. O mundo começa agora.*
