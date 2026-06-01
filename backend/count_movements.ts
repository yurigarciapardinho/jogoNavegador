import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const count = await prisma.movement.count()
  console.log('Total movements:', count)
}
main().then(() => prisma.$disconnect())
