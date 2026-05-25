import 'dotenv/config'
import { defineConfig } from '@prisma/config'

// Usa DIRECT_URL para operações de schema (push, migrate, seed) porque
// conexões via PgBouncer em modo transaction não suportam transações de longa duração.
const urlConexao = process.env.DIRECT_URL ?? process.env.DATABASE_URL

if (!urlConexao) {
    console.error('[ERRO FATAL] Nenhuma variável DATABASE_URL ou DIRECT_URL encontrada no arquivo .env')
    process.exit(1)
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: urlConexao,
    },
})