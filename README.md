# TW2 Clone — Motor de Jogo de Estratégia para Navegador 🏰

Bem-vindo ao repositório do **TW2 Clone**, uma base robusta e modular para a criação de jogos de estratégia em tempo real (RTS) diretamente no navegador, focado em construção de aldeias, gerenciamento de recursos, simulação de tropas e interações PvP com mapas dinâmicos.

Desenvolvido para atender os rigorosos padrões da comunidade de engenharia de software e game dev (Padrão YGP), este motor equilibra código assíncrono moderno com resiliência de produção.

## 📋 Pré-requisitos
Antes de começar, certifique-se de ter instalado em sua máquina:
- **Node.js** (versão 20.20 ou superior)
- **Gerenciador de pacotes NPM**
- **Docker** ou um banco de dados PostgreSQL rodando nativamente

---

## 🚀 Arquitetura do Sistema (A Fonte da Verdade)

Este jogo é impulsionado por um Monorepo que divide as responsabilidades rigidamente entre as camadas:

### ⚙️ Backend (Servidor)
A fonte inquestionável da verdade no jogo. Todo cálculo (construção de edifícios, marcha de tropas, saques) ocorre e é validado no backend, impedindo trapaças por parte do cliente.
- **Node.js + Fastify**: Altíssima performance para rotas e APIs RESTful rápidas.
- **Prisma ORM + PostgreSQL**: Persistência de dados ágil e segura, permitindo o desenvolvimento com bancos locais (Docker) ou nuvem (Supabase).
- **JWT Authentication**: Sistema state-less para sessões seguras sem onerar o banco de dados.

### 🎨 Frontend (Interface)
O frontend não toma decisões; ele apenas exibe as respostas validadas pelo servidor de forma otimizada e limpa.
- **Vite + React**: O framework da web moderna para a construção de UIs reativas.
- **PixiJS**: Motor de renderização WebGL que garante alto FPS ao processar mapas de dezenas de milhares de aldeias.
- **Zustand**: Gerenciamento de estado global flexível e previsível, substituindo o verboso Redux.
- **Arquitetura de API Segura**: Uma camada central (api.ts) captura e decodifica Códigos HTTP semânticos (400, 401, 500) para barrar e suavizar telas quebradas do usuário com Toast amigáveis.

---

## 🛡️ Ambientes e Segurança (Modos Dev vs Prod)

O repositório diferencia firmemente a segurança exigida para um desenvolvedor e a de um jogador final:

### 💻 Modo de Desenvolvimento
- Todos os erros retornam *Stack Traces* e mensagens crus diretamente no console e respostas JSON, facilitando o debug para o programador.
- **Vite (Dev Server)** exibe logs `console.log` para tracking de eventos em tempo real no navegador.

### 🌐 Modo de Produção
Quando `NODE_ENV=production` ou após a execução de `npm run build`:
1. **Backend Blindado (Catch-All Interceptor)**: A aplicação captura erros críticos (Status 500) que normalmente vazariam SQL ou lógicas, e mascara devolvendo _"Ocorreu um erro interno no servidor. Tente novamente mais tarde"_.
2. **Logs Ocultos**: A ferramenta de build (esbuild/Vite) limpa e destrói quaisquer menções a `console.log` ou `debugger` do bundle final. Nenhuma informação de debug chegará às mãos dos jogadores (Data Miners).
3. **Respostas Semânticas**: O Backend apenas manda _Status Codes_ claros (401=Unauthorized, 403=Forbidden, 400=Bad Request). É o Cliente Seguro quem decide que texto de erro mostrar em resposta a esse código, jamais confiando puramente num texto aberto enviado pela internet.

---

## 🕹️ Como Iniciar Rapidamente (Rede Local ou PC)

A maneira mais rápida e fácil de rodar o jogo (mesmo para acesso em rede local pelo seu celular Wi-Fi) é utilizar nosso script automatizado:

```bash
# Na raiz do projeto
chmod +x Iniciar.sh
./Iniciar.sh
```
Ele vai te guiar interativamente para:
1. Escolher Banco Local (via Docker automático) ou Nuvem (Supabase).
2. Definir se você quer jogar apenas no seu computador ou abrir na rede local para testes em Mobile.
3. Subir e orquestrar todas as instâncias simultaneamente!

*(Para encerrar, basta apertar `Ctrl+C` a qualquer momento, e ele desligará o Banco, Backend e Frontend).*

---

## 🛠️ Execução Manual Detalhada

### Configurando o Servidor (Backend)
1. Entre na pasta `backend` e configure as variáveis de ambiente (banco de dados e chaves):
```bash
cd backend
cp .env.example .env
npm install
```
2. Prepare e alimente o Banco de Dados com as tabelas e os administradores iniciais:
```bash
npx prisma db push
npm run db:seed
```
3. Inicie o servidor:
```bash
# Modo Isolado (Apenas seu computador acessa)
npm run dev

# Modo Rede Aberta / LAN (Amigos no mesmo Wi-Fi podem acessar seu PC via IP)
npm run dev:lan
```
*(Se a porta 8080 estiver ocupada, o servidor é autogerenciado e abrirá em 8081 automaticamente!)*

### Configurando o Jogo (Frontend)
1. Instale e inicie a interface do jogador (Vite):
```bash
cd frontend
npm install

# Modo Isolado
npm run dev

# Modo Rede Aberta / LAN (Permite acesso via celular na mesma rede)
npm run dev:lan
```
*(O frontend é autossuficiente e interceptará automaticamente se deve conectar ao Backend de forma isolada ou via rede local).*

---

## 🗂️ Arquivos e Core do Repositório

- Central de API do Cliente: `frontend/src/api.ts`
- Tratamento Global de Erros: `backend/src/server.ts` (setErrorHandler)
- Mecânica de Batalha (Saque / Destruição): `backend/src/routes/village.ts` 
- Lógica de Tropas (Web Worker de Simulação - Opcional p/ o futuro): `backend/src/services/`
- Renderização de Mapa WebGL: `frontend/src/game/MotorMapa.ts`

---

## 👑 Centro de Comando (Admin God Mode)

O jogo possui um Painel de Administração robusto com estética "Glassmorphism", integrado com gráficos dinâmicos de alta performance e ferramentas perigosas de gerenciamento global.

Ao utilizar o comando `npm run db:seed` na instalação, o sistema gera automaticamente as credenciais supremas:

- **E-mail:** `ygarciapardinho@gmail.com`
- **Senha:** `Yuri.garcia,18`

Faça o login com esta conta na tela inicial e clique em **"Painel Admin"** no cabeçalho.
Lá dentro você terá controle total de 5 frentes:
1. **KPIs (Visão Geral):** Gráficos e cartões em tempo real sobre a economia e os usuários.
2. **Mesa de Guerra:** Paginação, busca avançada e alteração imediata de recursos ou tropas de qualquer aldeia, ou aniquilação permanente.
3. **Gestão de Contas:** Promova jogadores ao cargo de `ADMIN` ou dê banimento permanente (onde as aldeias dele se tornarão Bárbaras).
4. **Auditoria:** Uma linha do tempo (Timeline) que dedura imutavelmente todas as ações executadas por administradores no jogo (contém botão para ocultação de rastros).
5. **Servidor (Nuke):** Uma área de risco extremo (*Wipe Global*) capaz de apagar todas as tabelas do banco de dados instantaneamente, garantindo a preservação exclusiva de quem ativou a ferramenta.
Mantenha a segurança e sanidade da base de código:
1. Todo código TypeScript novo deve aderir às restrições "strict" do compilador. Não utilize `any`.
2. Para sugerir ou injetar mecânicas de gameplay (Batalhas Navais, Clima Dinâmico), ramifique o repositório como `feat/nova-mecanica` e documente a fórmula matemática usada no Backend.

---
_Desenvolvido com padrão de qualidade e arquitetura YGP._
