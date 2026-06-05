import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const units = await prisma.villageUnit.findMany();
    console.log("Units:", units);
    const movs = await prisma.movement.findMany({
        where: { type: 'RETURN' }
    });
    console.log("Returns:", movs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
