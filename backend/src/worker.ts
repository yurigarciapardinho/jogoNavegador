import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'
import dns from 'node:dns'
import { startCombatLoop } from './gameLogic/combatLoop'

dns.setDefaultResultOrder('ipv4first')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
    console.error('[ERRO FATAL] A variável de ambiente DATABASE_URL não está definida no Worker.')
    process.exit(1)
}

const pool = new Pool({ 
    connectionString: databaseUrl,
    max: 5
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

console.log("🚀 Motor de Combate (Worker) rodando...");

// Inicia o motor de combate (loop isolado do servidor HTTP)
startCombatLoop(prisma)

const shutdown = async () => {
    console.log("🛑 Encerrando Worker de Combate...");
    await prisma.$disconnect();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
