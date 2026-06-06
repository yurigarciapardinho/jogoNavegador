# Deploy Alpha Fechado — K.A.S.T.

## 1. Pré-requisitos
* Node 20+
* PostgreSQL
* Conta no Render (para o Backend)
* Conta na Vercel (para o Frontend)
* Variáveis de ambiente configuradas
* Credenciais rotacionadas (segredos antigos já expostos devem ser descartados e trocados)

## 2. Segurança antes do deploy
* Rotacionar credenciais vazadas: Se você já comitou senhas reais do banco (Supabase) no histórico do Git (por exemplo no arquivo wipe-remote.ts antigo), **considere-as vazadas** e gere novas credenciais no Supabase.
* Gerar `JWT_SECRET` forte: Use uma chave complexa, longa e secreta e nunca coloque no código.
* Nunca commitar `.env`: Certifique-se de que nenhum `.env` suba pro repositório. O `.gitignore` atual já bloqueia isso.
* Configurar `CORS_ORIGIN`: Configure com o domínio exato de produção (ex: `https://seu-frontend.vercel.app`).
* Não usar `*` em produção: O servidor falhará fatalmente se detectar ambiente de produção sem a variável `CORS_ORIGIN` estrita.

## 3. Banco de dados
* **DATABASE_URL**: A string de conexão, ex: `postgresql://usuario:senha@host:5432/postgres?pgbouncer=true` (Para conexão com pooler).
* **DIRECT_URL**: A string direta para o banco, obrigatória para o Prisma conseguir interagir e migrar o banco.
* **Diferença entre `db push` e migrations**:
  Como não há migrations prontas geradas neste projeto, para o **Alpha Rápido** recomenda-se usar `npx prisma db push` que sincronizará diretamente seu schema com o banco na nuvem. Contudo, **O caminho correto e definitivo para a produção plena** é gerar as migrações (com `npx prisma migrate dev`) e na hora do deploy usar o comando `npx prisma migrate deploy`.

## 4. Backend API no Render
* **Root Directory**: `backend`
* **Build Command**: `npm install && npx prisma generate`
* **Start Command**: `npm run start:api`
* **Variáveis necessárias**:
  - `NODE_ENV=production`
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `JWT_SECRET`
  - `CORS_ORIGIN=https://url-da-vercel`
  - `CONSELHEIRO_URL` (Opcional. A API sobe mesmo sem essa variável. Apenas a rota `/conselheiro` fica indisponível e retorna 503. Para ativar a IA, suba o serviço correspondente e configure essa variável.)
## 5. Worker no Render (Motor de Combate e Filas)
* **Root Directory**: `backend`
* **Build Command**: `npm install && npx prisma generate`
* **Start Command**: `npm run start:worker`
* **Variáveis necessárias**:
  - `NODE_ENV=production`
  - `DATABASE_URL`
  - `DIRECT_URL`
* **Aviso de worker único**: Configure no Render para **rodar apenas 1 instância do Worker** por vez. O motor de combate atual não conta com "lock/claim" atômico no banco. Se existirem 2 instâncias ligadas ao mesmo tempo lendo os mesmos movimentos, elas podem processar duplamente as tropas.

## 6. Frontend na Vercel
* **Root Directory**: `frontend`
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Variável Necessária**:
  `VITE_API_URL=https://url-da-api-no-render.com`

## 7. Checklist de teste pós deploy
* Cadastrar usuário (Verificar JWT).
* Fazer login.
* Criar a primeira aldeia e validar posições no mapa.
* Ver saldo de recursos fluindo.
* Iniciar construção no Edifício Principal.
* Construir quartel.
* Recrutar tropas (lança/espada).
* Abrir mapa da região.
* Atacar uma aldeia bárbara.
* Aguardar o Worker processar o ataque no horário exato de impacto.
* Ver o Relatório de Combate aparecer na aba de Relatórios.
* Verificar tropas retornando com o saque de recursos e desembarcando na aldeia de volta.

## 8. Riscos conhecidos
* **Sem testes automatizados reais**: Tudo foi testado manualmente de ponta a ponta.
* **Worker único (Single Point of Failure / Bottleneck)**: Um único servidor cuidando de todo o combate.
* **Segredo vazado no histórico**: Uma URL do Supabase antiga esteve exposta nos arquivos antigos. **Ação imediata: Gire a senha no Supabase antes de rodar o Alpha.**
* Alpha fechada, não é um deploy aberto (Não possui mitigação extensa contra DDoS, etc).
