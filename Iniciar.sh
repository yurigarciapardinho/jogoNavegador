#!/usr/bin/env bash
# =============================================================================
# Iniciar — Script de inicialização do TW2 Clone (YGP)
# =============================================================================
# Inicia o backend (Fastify) e o frontend (Vite) em paralelo,
# exibe os logs de ambos no terminal e encerra tudo ao pressionar Ctrl+C.
# =============================================================================

# ─── Cores para o terminal ───────────────────────────────────────────────────
RESET="\033[0m"
BOLD="\033[1m"
VERDE="\033[0;32m"
AMARELO="\033[0;33m"
AZUL="\033[0;34m"
CIANO="\033[0;36m"
VERMELHO="\033[0;31m"

# ─── Diretório raiz do projeto ────────────────────────────────────────────────
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR_BACKEND="$RAIZ/backend"
DIR_FRONTEND="$RAIZ/frontend"

# PIDs dos processos filhos (preenchidos ao iniciar)
PID_API=""
PID_WORKER=""
PID_FRONTEND=""

# Flag para evitar reentrada na função de limpeza
_ENCERRANDO=0

limpeza() {
    [ "$_ENCERRANDO" -eq 1 ] && return
    _ENCERRANDO=1

    echo ""
    echo -e "${AMARELO}${BOLD}Encerrando TW2 Clone...${RESET}"

    [ -n "$PID_API" ]  && kill "$PID_API"  2>/dev/null || true
    [ -n "$PID_WORKER" ]  && kill "$PID_WORKER"  2>/dev/null || true
    [ -n "$PID_FRONTEND" ] && kill "$PID_FRONTEND" 2>/dev/null || true

    wait "$PID_API"  2>/dev/null || true
    wait "$PID_WORKER"  2>/dev/null || true
    wait "$PID_FRONTEND" 2>/dev/null || true

    echo -e "${VERDE}${BOLD}Sistema encerrado com sucesso.${RESET}"
    exit 0
}

trap limpeza INT TERM

# ─── Verificações iniciais ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}============================================${RESET}"
echo -e "${BOLD}       TW2 Clone — Iniciando sistema       ${RESET}"
echo -e "${BOLD}============================================${RESET}"
echo ""

# Verifica Node.js
if ! command -v node &>/dev/null; then
    echo -e "${VERMELHO}[ERRO] Node.js não encontrado. Instale em: https://nodejs.org${RESET}"
    exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${VERMELHO}[ERRO] Node.js v20+ é necessário. Versão atual: $(node -v)${RESET}"
    exit 1
fi

# Verifica .env do backend
if [ ! -f "$DIR_BACKEND/.env" ]; then
    echo -e "${AMARELO}[AVISO] Arquivo backend/.env não encontrado. Será gerado agora.${RESET}"
fi

echo -e "${CIANO}${BOLD}Onde deseja rodar o banco de dados?${RESET}"
echo -e "  [1] ${VERDE}Local${RESET} (Docker PostgreSQL)"
echo -e "  [2] ${AZUL}Nuvem${RESET} (Supabase)"
read -p "Escolha [1/2] (Padrão 1): " OPCAO_BD

if [ "$OPCAO_BD" == "2" ]; then
    echo -e "${AZUL}[Banco de Dados] Opção em Nuvem selecionada.${RESET}"
    echo -e "${AMARELO}[ATENÇÃO] Configure manualmente as credenciais em backend/.env conforme backend/.env.example${RESET}"
    
    if [ ! -f "$DIR_BACKEND/.env" ]; then
        cat <<EOF > "$DIR_BACKEND/.env"
# Configuração pendente para Banco de Dados na Nuvem
DATABASE_URL="postgresql://usuario:senha@host:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://usuario:senha@host:5432/postgres"
PORT=8080
CONSELHEIRO_URL="http://localhost:3000/perguntar"
CORS_ORIGIN="*"
EOF
    fi
else
    echo -e "${VERDE}[Banco de Dados] Configurando para Local (Docker)...${RESET}"
    if ! command -v docker &>/dev/null; then
        echo -e "${VERMELHO}[ERRO] Docker não encontrado. Instale o Docker ou escolha a opção Supabase.${RESET}"
        exit 1
    fi
    
    # Verifica se o container existe e está rodando
    if ! docker ps | grep -q "local-postgres"; then
        echo -e "${AMARELO}[Docker] Iniciando container local-postgres...${RESET}"
        # Tenta iniciar o container existente ou cria um novo
        docker start local-postgres 2>/dev/null || docker run --name local-postgres -e POSTGRES_PASSWORD=tw2_pass -e POSTGRES_USER=tw2_user -e POSTGRES_DB=tw2_db -p 5432:5432 -d postgres:15
        echo -e "${AMARELO}[Docker] Aguardando inicialização do banco (3s)...${RESET}"
        sleep 3
    fi

    cat <<EOF > "$DIR_BACKEND/.env"
# PostgreSQL — Local Docker
DATABASE_URL="postgresql://tw2_user:tw2_pass@localhost:5432/tw2_db?schema=public"
DIRECT_URL="postgresql://tw2_user:tw2_pass@localhost:5432/tw2_db?schema=public"
PORT=8080
CONSELHEIRO_URL="http://localhost:3000/perguntar"
CORS_ORIGIN="*"
EOF
fi

# Configuração de Rede Local
echo ""
echo -e "${CIANO}${BOLD}Deseja permitir acesso pela rede local? (Para jogar no celular via Wi-Fi)${RESET}"
read -p "Escolha [S/N] (Padrão N): " OPCAO_REDE

HOST_ENV="127.0.0.1"
FRONTEND_ARGS=""
IP_LOCAL="localhost"

if [[ "$OPCAO_REDE" =~ ^[SsYy]$ ]]; then
    HOST_ENV="0.0.0.0"
    FRONTEND_ARGS="--host"
    IP_LOCAL=$(hostname -I | awk '{print $1}')
    if [ -z "$IP_LOCAL" ]; then
        IP_LOCAL="localhost"
    fi
    echo -e "${VERDE}[Rede] Acesso local habilitado. IP: $IP_LOCAL${RESET}"
else
    echo -e "${AMARELO}[Rede] Acesso restrito ao localhost.${RESET}"
fi

# Verifica .env do frontend — cria do exemplo se não existir
if [ ! -f "$DIR_FRONTEND/.env" ]; then
    echo -e "${AMARELO}[AVISO] Arquivo frontend/.env não encontrado.${RESET}"
    echo -e "        Criando com valores padrão a partir do exemplo..."
    cp "$DIR_FRONTEND/.env.example" "$DIR_FRONTEND/.env"
    echo -e "${VERDE}        frontend/.env criado. Edite-o com o VITE_VILLAGE_ID correto.${RESET}"
fi

# Atualiza VITE_API_URL no frontend para apontar para o IP local caso seja habilitado
# Para facilitar, a URL dinâmica ficará a cargo do frontend (window.location.hostname),
# mas podemos atualizar o VITE_API_URL apenas por segurança.

# Instala dependências do backend se necessário
if [ ! -d "$DIR_BACKEND/node_modules" ]; then
    echo -e "${AMARELO}[Backend]  Instalando dependências...${RESET}"
    (cd "$DIR_BACKEND" && npm install --silent)
    echo -e "${VERDE}[Backend]  Dependências instaladas.${RESET}"
fi

# Instala dependências do frontend se necessário
if [ ! -d "$DIR_FRONTEND/node_modules" ]; then
    echo -e "${AMARELO}[Frontend] Instalando dependências...${RESET}"
    (cd "$DIR_FRONTEND" && npm install --silent)
    echo -e "${VERDE}[Frontend] Dependências instaladas.${RESET}"
fi

echo ""
echo -e "${VERDE}${BOLD}✓ Verificações concluídas. Iniciando serviços...${RESET}"
echo ""
if [[ "$OPCAO_REDE" =~ ^[SsYy]$ ]]; then
    echo -e "  ${AZUL}${BOLD}Backend API:${RESET} http://${IP_LOCAL}:8080"
    echo -e "  ${CIANO}${BOLD}Jogo (Web):${RESET}  http://${IP_LOCAL}:5173"
    echo -e "  ${AMARELO}Acesse a URL do Jogo no navegador do seu celular!${RESET}"
else
    echo -e "  ${AZUL}${BOLD}Backend:${RESET}   http://localhost:8080"
    echo -e "  ${CIANO}${BOLD}Frontend:${RESET}  http://localhost:5173"
fi
echo ""
echo -e "${AMARELO}Pressione Ctrl+C para encerrar ambos os serviços.${RESET}"
echo -e "${BOLD}--------------------------------------------${RESET}"
echo ""

# ─── Inicia a API do backend em background com prefixo nos logs ─────────────────────
(
    cd "$DIR_BACKEND"
    HOST="$HOST_ENV" npm run dev:api 2>&1 | while IFS= read -r linha; do
        printf "\033[0;34m[Backend API]\033[0m %s\n" "$linha"
    done
) &
PID_API=$!

# Aguarda a API subir um pouco antes de iniciar o Worker e o Frontend
sleep 1

# ─── Inicia o Worker de combate em background ─────────────────────────────────────
(
    cd "$DIR_BACKEND"
    HOST="$HOST_ENV" npm run dev:worker 2>&1 | while IFS= read -r linha; do
        printf "\033[0;35m[Worker]\033[0m      %s\n" "$linha"
    done
) &
PID_WORKER=$!

sleep 1

# ─── Inicia o frontend em background com prefixo nos logs ────────────────────
(
    cd "$DIR_FRONTEND"
    npm run dev -- $FRONTEND_ARGS 2>&1 | while IFS= read -r linha; do
        printf "\033[0;36m[Frontend]\033[0m    %s\n" "$linha"
    done
) &
PID_FRONTEND=$!

# Aguarda todos — bloqueia até Ctrl+C ou até um processo encerrar inesperadamente
wait $PID_API $PID_WORKER $PID_FRONTEND
