import { PrismaClient } from '@prisma/client'
console.log(Object.keys(new PrismaClient()._getDmmf().modelMap.Movement.fields))
