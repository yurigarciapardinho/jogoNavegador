import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { getWarehouseCapacity } from '../gameLogic/economy'

const QUESTS = [
    {
        id: "BUILD_HQ_2",
        title: "Edifique a Sede",
        description: "Evolua a Sede para o Nível 2.",
        checkCondition: (village: any) => (village.buildings?.headquarters || 0) >= 2,
        rewards: { wood: 100, clay: 100, iron: 100 }
    },
    {
        id: "BUILD_TIMBER_2",
        title: "Mais Madeira",
        description: "Evolua o Bosque para o Nível 2.",
        checkCondition: (village: any) => (village.buildings?.timberCamp || 0) >= 2,
        rewards: { wood: 50, clay: 150, iron: 100 }
    },
    {
        id: "BUILD_CLAY_2",
        title: "O Forno",
        description: "Evolua o Poço de Argila para o Nível 2.",
        checkCondition: (village: any) => (village.buildings?.clayPit || 0) >= 2,
        rewards: { wood: 150, clay: 50, iron: 100 }
    },
    {
        id: "BUILD_IRON_2",
        title: "Metal Pesado",
        description: "Evolua a Mina de Ferro para o Nível 2.",
        checkCondition: (village: any) => (village.buildings?.ironMine || 0) >= 2,
        rewards: { wood: 100, clay: 100, iron: 150 }
    },
    {
        id: "BUILD_BARRACKS_1",
        title: "Preparação para a Guerra",
        description: "Construa o Quartel.",
        checkCondition: (village: any) => (village.buildings?.barracks || 0) >= 1,
        rewards: { wood: 200, clay: 200, iron: 200 }
    }
]

export default async function questRoutes(fastify: FastifyInstance, opts: { prisma: PrismaClient }) {
    const { prisma } = opts

    // Listar missões do jogador
    fastify.get('/quests', { preValidation: [fastify.authenticate] }, async (request, reply) => {
        const user = (request as any).user
        if (!user) return reply.code(401).send({ error: 'Não autorizado' })

        // Pega a aldeia primária para checar condições
        const village = await prisma.village.findFirst({
            where: { userId: user.id },
            include: { buildings: true }
        })

        if (!village) return reply.code(404).send({ error: 'Aldeia não encontrada' })

        // Pega o progresso salvo
        const userQuests = await prisma.userQuest.findMany({
            where: { userId: user.id }
        })

        const result = QUESTS.map(q => {
            const dbQuest = userQuests.find(uq => uq.questId === q.id)
            const isCompleted = dbQuest?.completed || q.checkCondition(village)
            
            return {
                id: q.id,
                title: q.title,
                description: q.description,
                rewards: q.rewards,
                completed: isCompleted,
                claimed: dbQuest?.claimed || false
            }
        })

        return { quests: result }
    })

    // Reivindicar recompensa
    fastify.post('/quests/:questId/claim', { preValidation: [fastify.authenticate] }, async (request, reply) => {
        const user = (request as any).user
        if (!user) return reply.code(401).send({ error: 'Não autorizado' })

        const { questId } = request.params as { questId: string }
        const questDef = QUESTS.find(q => q.id === questId)

        if (!questDef) return reply.code(404).send({ error: 'Missão não existe' })

        const village = await prisma.village.findFirst({
            where: { userId: user.id },
            include: { buildings: true, resources: true }
        })

        if (!village) return reply.code(404).send({ error: 'Aldeia não encontrada' })

        // Checar condição real de novo
        if (!questDef.checkCondition(village)) {
            return reply.code(400).send({ error: 'Você não cumpriu os requisitos desta missão ainda.' })
        }

        // Tentar reivindicar numa transação para não duplicar
        try {
            await prisma.$transaction(async (tx) => {
                const existingQuest = await tx.userQuest.findUnique({
                    where: { userId_questId: { userId: user.id, questId } }
                })

                if (existingQuest?.claimed) {
                    throw new Error('Missão já foi resgatada!')
                }

                if (existingQuest) {
                    await tx.userQuest.update({
                        where: { id: existingQuest.id },
                        data: { completed: true, claimed: true }
                    })
                } else {
                    await tx.userQuest.create({
                        data: {
                            userId: user.id,
                            questId: questId,
                            completed: true,
                            claimed: true
                        }
                    })
                }

                // Dar recursos
                const warehouseCap = getWarehouseCapacity(village.buildings?.warehouse || 1)
                const res = village.resources!
                
                await tx.villageResource.update({
                    where: { villageId: village.id },
                    data: {
                        wood: Math.min(warehouseCap, res.wood + questDef.rewards.wood),
                        clay: Math.min(warehouseCap, res.clay + questDef.rewards.clay),
                        iron: Math.min(warehouseCap, res.iron + questDef.rewards.iron)
                    }
                })
            })

            return { message: 'Recompensa resgatada com sucesso!' }
        } catch (e: any) {
            return reply.code(400).send({ error: e.message })
        }
    })
}
