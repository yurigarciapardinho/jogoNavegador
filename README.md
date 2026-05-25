# TW2 Clone — Motor de Jogo de Estratégia para Navegador

Uma base modular para jogos de estratégia em tempo real (RTS) focada em construção de aldeias, gestão de recursos e filas de construção. Código em TypeScript com atenção à performance, testabilidade e ao padrão de código YGP (veja [documento_padrao_ygp.md](documento_padrao_ygp.md)).

## Tecnologias

- Frontend: React, Vite, Tailwind CSS, PixiJS
- State: Zustand
- Backend: Node.js, Fastify, TypeScript
- Banco: PostgreSQL (Supabase recomendado)
- ORM: Prisma

## Requisitos

- Node.js 18+ e npm
- Acesso a um banco PostgreSQL (Supabase ou instância própria)

## Visão geral das alterações recentes

- O backend agora realiza logs amigáveis em português (YGP) e trata `EADDRINUSE` automaticamente: se a porta configurada estiver ocupada, ele tenta a próxima porta disponível (até 10 tentativas) e imprime a porta final no console.
- O `prisma.config.ts` carrega variáveis de ambiente via `dotenv` e fornece a `datasource.url` para a CLI do Prisma.
- Adicionei um template seguro: [backend/.env.example](backend/.env.example).

## Instalação e Execução Local

### Backend

1. Entre na pasta do backend:

```bash
cd backend
```

2. Copie o exemplo de `.env` e preencha a sua conexão PostgreSQL:

```bash
cp .env.example .env
# Edite backend/.env e defina DATABASE_URL
```

3. Instale dependências e prepare o Prisma:

```bash
npm install
npx prisma db push
npx prisma generate
```

4. Rode o seed (cria usuário + aldeia inicial). O script imprime o ID da aldeia gerada — guarde este ID para o frontend:

```bash
npm run db:seed
# o script imprime um ID (UUID) da aldeia
```

5. Inicie o servidor (o valor de `PORT` em `backend/.env` é usado como base):

```bash
# usa PORT do .env (Number). Se porta estiver ocupada, o servidor tentará porta+1 automaticamente.
npm run dev
```

Ao iniciar o servidor você verá no console uma mensagem humana indicando a porta final, por exemplo:

```
TW2 Clone — Servidor (YGP)
Servidor do jogo rodando na porta 8080
Acesse o backend em: http://localhost:8080
```

Se quiser forçar uma porta fixa (não recomendada quando outra instância pode rodar), exporte `PORT` antes de iniciar:

```bash
PORT=8080 npm run dev
```

### Frontend

1. Entre na pasta do frontend e instale dependências:

```bash
cd frontend
npm install
```

2. Configure o ID da aldeia (opcional): o componente `src/components/VillageScreen.tsx` usa um ID de aldeia para buscar dados. Substitua pelo ID gerado pelo seed se necessário.

3. Inicie o servidor de desenvolvimento (Vite):

```bash
npm run dev
# Vite serve por padrão em http://localhost:5173/
```

Se o navegador tentou `http://localhost:5174/` e recebeu `ERR_CONNECTION_REFUSED`, confirme que o Vite está rodando em `5173` (ou no host/porta que o Vite imprimiu). Para forçar porta estrita use:

```bash
# altera o script de dev em frontend/package.json para:
# "dev": "vite --port 5173 --strictPort"
```

## Arquivos importantes

- Template de ambiente: [backend/.env.example](backend/.env.example)
- Config do Prisma (CLI config): [backend/prisma.config.ts](backend/prisma.config.ts)
- Schema Prisma: [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
- Servidor (tratamento de porta e logs): [backend/src/server.ts](backend/src/server.ts)
- Entry do frontend: [frontend/src/main.tsx](frontend/src/main.tsx)
- Componente da aldeia: [frontend/src/components/VillageScreen.tsx](frontend/src/components/VillageScreen.tsx)
- Padrão YGP: [documento_padrao_ygp.md](documento_padrao_ygp.md)

## Troubleshooting rápido

- Tela em branco no frontend: verifique `frontend/src/main.tsx` (deve montar o app React) e abra DevTools → Console para ver erros. Também confirme que `http://localhost:5173/` responde.
- `ERR_CONNECTION_REFUSED` em 5174: use a porta que o Vite indicou no terminal (geralmente 5173). Se precisar de uma porta fixa, use `--strictPort`.
- Seed falhando com `getaddrinfo EAI_AGAIN` ou erros de conexão: verifique se `backend/.env` tem `DATABASE_URL` bem formada (sem aspas duplicadas nem texto extra). Use [backend/.env.example](backend/.env.example) como referência.
- Prisma reclamando que `datasource.url` é obrigatório: o projeto agora fornece a URL a partir de `backend/prisma.config.ts` — garanta que `backend/.env` exista e contenha `DATABASE_URL`.

## Como obter o ID da aldeia criado pelo seed

Ao rodar `npm run db:seed` o script imprime o UUID da aldeia criada. Copie esse valor e cole em `frontend/src/components/VillageScreen.tsx` no lugar do placeholder.

## Contribuição

Para sugestões, correções e melhorias, abra um branch e envie um pull request. Sugestão de branch names:

- `fix/server-ports-logs` — correções de porta/logs
- `feat/frontend-entry` — melhorias no frontend entry

Comandos úteis para criar branch e fazer commit:

```bash
git checkout -b fix/server-ports-logs
git add -A
git commit -m "fix: tratar porta ocupada e melhorar logs (YGP)"
git push origin fix/server-ports-logs
```

---

Se quiser, eu crio o branch e abro o PR com as mudanças que apliquei localmente.

---

Desenvolvido por Yuri Garcia Pardinho (@yurigarciapardinho)
