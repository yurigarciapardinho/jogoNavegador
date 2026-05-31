import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    let conf = await prisma.serverConfig.findFirst()
    if (conf) {
        await prisma.serverConfig.update({ where: { id: conf.id }, data: { speedMultiplier: 4.0 } })
        console.log('Speed set to 4x')
    } else {
        await prisma.serverConfig.create({ data: { speedMultiplier: 4.0 } })
        console.log('Created config with 4x speed')
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
