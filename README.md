<div align="center">
  <img src="./docs/assets/banner.png" alt="K.A.S.T. Banner" width="100%" />
  <br />
  <br />

  ![Versão Alpha](https://img.shields.io/badge/Vers%C3%A3o-Alpha-orange)
  ![Licença MIT](https://img.shields.io/badge/Licen%C3%A7a-MIT-blue)
  ![NodeJS 20+](https://img.shields.io/badge/Node-20%2B-brightgreen)
  ![Motor PixiJS](https://img.shields.io/badge/Motor-PixiJS-ff69b4)
  ![Status em Desenvolvimento](https://img.shields.io/badge/Status-Em%20Desenvolvimento-red)

</div>

<br />

> *"O controle do território não é dado, é conquistado."*

**K.A.S.T.** (Kommuna de Aliança e Soberania das Terras) é um MMO de estratégia em tempo real focado em alta performance e gestão tática militar. Desenvolvido do zero para rodar nativamente no navegador utilizando renderização WebGL e cálculos paralelos em Worker. 

Aqui, cada segundo da sua logística importa. Administre a economia local de suas aldeias, despache mercadores em missões perigosas, fortifique muralhas e coordene ataques táticos massivos contra inimigos que não dormem. 

---

## ⚙️ Arquitetura de Guerra

K.A.S.T. não é um jogo de browser tradicional. É construído sob uma fundação moderna projetada para suportar a matemática de milhares de tropas interagindo assincronamente:

- 🗺️ **Motor WebGL Desacoplado**: O mapa tático é orquestrado através do `PixiJS`, operando a 60 FPS fluídos com translação de objetos baseada em estado global.
- ⏱️ **Servidor Dual-Thread**: A API principal roda em `Fastify` e despacha as conexões, enquanto um `Worker` paralelo roda em loop infinito resolvendo as colisões militares (Ticks) para que as requisições não sofram gargalo.
- 🛡️ **Segurança Militar de Dados**: Camadas estritas de validação interceptam payloads na raiz, com as transações sendo validadas nativamente no `PostgreSQL` através do `Prisma ORM`.
- ⚡ **Frontend Reativo**: Escrito em `React` e `Vite`, estilizado de ponta a ponta com `Vanilla CSS` de alta performance e uso de stores eficientes (`Zustand`).

---

## 🛠️ Levantando seu Império Localmente

Iniciar os motores do K.A.S.T. em sua máquina é um processo automatizado. Siga o guia abaixo de acordo com seu Sistema Operacional.

### 🐧 Linux & 🍏 macOS

Abra seu terminal favorito:

```bash
# 1. Clone os arquivos de guerra
git clone https://github.com/yurigarciapardinho/kast.git
cd kast

# 2. Autorize a ignição do motor
chmod +x Iniciar.sh

# 3. Levante o império
./Iniciar.sh
```

### 🪟 Windows (WSL ou Git Bash)

Como o sistema lida com orquestração pesada de serviços, o motor roda nativamente via Bash. Esqueça o CMD e o PowerShell tradicional. Abra o diretório do projeto usando o **Git Bash** (que costuma vir instalado com o Git) ou seu terminal **WSL**:

```bash
# Dentro da pasta principal no Git Bash ou WSL:
bash Iniciar.sh
```

### 🧙‍♂️ O Assistente de Iniciação
Ao rodar o `Iniciar.sh`, você não será largado no escuro. O script fará tudo por você, incluindo o download das bibliotecas pesadas e a montagem das chaves de segurança. 
Ele fará apenas duas perguntas simples:
1. **Onde vai rodar o Banco?** Digite `1` para que o script automaticamente levante um banco de dados `PostgreSQL` isolado via Docker na sua máquina.
2. **Acesso pela rede?** Digite `S` (Sim) se você planeja testar a interface diretamente pelo seu celular através do mesmo Wi-Fi que o seu computador.

---

## ⚔️ Primeiros Passos na Soberania

1. Após o script brilhar verde no seu console, abra o link principal exibido (por padrão: `http://localhost:5173`).
2. Acesse a tela de **Criar Conta**. Digite um usuário válido e forneça uma senha forte (agora temos dupla autenticação).
3. Seja transportado para sua primeira aldeia. Clique em edifícios para entender o balanço de Madeira, Argila e Ferro.
4. Navegue pelo **Mapa**, recrute Bárbaros ou Lanceiros e inicie sua jornada militar!

---

<div align="center">
  <i>Construído com sangue, código e glória.</i>
</div>
