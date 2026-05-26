import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('[Clean] Iniciando limpeza do banco de dados (Supabase)...')
    
    await prisma.movement.deleteMany()
    await prisma.combatReport.deleteMany()
    await prisma.buildingQueue.deleteMany()
    await prisma.unitQueue.deleteMany()
    await prisma.villageResource.deleteMany()
    await prisma.villageUnit.deleteMany()
    await prisma.villageBuilding.deleteMany()
    await prisma.village.deleteMany()
    
    const deletados = await prisma.user.deleteMany({
        where: { role: { not: 'ADMIN' } }
    })
    
    console.log(`[Clean] ${deletados.count} jogadores deletados. Apenas o Admin foi mantido.`)
    console.log('[Clean] As Bárbaras, relatórios e vilas também foram completamente resetados.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
