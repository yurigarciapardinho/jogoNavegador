import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

async function clearDB() {
    console.log('Iniciando limpeza do banco de dados...')
    const prisma = new PrismaClient()

    try {
        await prisma.adminLog.deleteMany({})
        await prisma.combatReport.deleteMany({})
        await prisma.movement.deleteMany({})
        await prisma.unitQueue.deleteMany({})
        await prisma.buildingQueue.deleteMany({})
        await prisma.villageResource.deleteMany({})
        await prisma.villageBuilding.deleteMany({})
        await prisma.villageUnit.deleteMany({})
        await prisma.village.deleteMany({})
        await prisma.user.deleteMany({})
        console.log('✅ Banco de dados limpo com sucesso!')
    } catch (e) {
        console.error('❌ Erro ao limpar o banco de dados:', e)
    } finally {
        await prisma.$disconnect()
    }
}

clearDB()
