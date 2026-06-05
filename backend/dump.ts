import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const movs = await prisma.movement.findMany({
        where: { type: 'RETURN' }
    })
    console.log("RETURN Movements:", movs)

    const attacks = await prisma.movement.findMany({
        where: { type: 'ATTACK' }
    })
    console.log("ATTACK Movements:", attacks)

    const units = await prisma.villageUnit.findMany()
    console.log("Village Units:", units)
}
main().catch(console.error).finally(() => prisma.$disconnect())
