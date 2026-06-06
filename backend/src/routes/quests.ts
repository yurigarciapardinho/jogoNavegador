import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { getWarehouseCapacity } from '../gameLogic/economy'

interface QuestDef {
    id: string
    title: string
    description: string
    prerequisites: string[]
    checkCondition: (village: any, prisma: PrismaClient) => boolean | Promise<boolean>
    rewards: { wood: number, clay: number, iron: number }
}

const QUESTS: QuestDef[] = [
    {
        id: "Q_HQ_2",
        title: "Edifique a Sede",
        description: "A sua jornada começa aqui. Evolua a Sede para o Nível 2 para desbloquear novos edifícios.",
        prerequisites: [],
        checkCondition: (village) => (village.buildings?.headquarters || 0) >= 2,
        rewards: { wood: 150, clay: 150, iron: 150 }
    },
    {
        id: "Q_RES_1",
        title: "Produção Básica",
        description: "Seu império precisa de matéria-prima. Construa o Bosque, o Poço de Argila e a Mina de Ferro no Nível 1.",
        prerequisites: ["Q_HQ_2"],
        checkCondition: (village) => (village.buildings?.timberCamp || 0) >= 1 && 
                                     (village.buildings?.clayPit || 0) >= 1 && 
                                     (village.buildings?.ironMine || 0) >= 1,
        rewards: { wood: 200, clay: 200, iron: 200 }
    },
    {
        id: "Q_HQ_3",
        title: "Preparando Expansão",
        description: "O Quartel requer uma fundação sólida. Evolua a Sede para o Nível 3.",
        prerequisites: ["Q_RES_1"],
        checkCondition: (village) => (village.buildings?.headquarters || 0) >= 3,
        rewards: { wood: 250, clay: 250, iron: 200 }
    },
    {
        id: "Q_BARRACKS_1",
        title: "O Quartel",
        description: "É hora de nos defendermos. Construa o Quartel.",
        prerequisites: ["Q_HQ_3"],
        checkCondition: (village) => (village.buildings?.barracks || 0) >= 1,
        rewards: { wood: 200, clay: 200, iron: 200 }
    },
    {
        id: "Q_RECRUIT_5_SPEAR",
        title: "As Primeiras Lanças",
        description: "Treine pelo menos 5 Lanceiros no Quartel para proteger as muralhas.",
        prerequisites: ["Q_BARRACKS_1"],
        checkCondition: (village) => (village.units?.spear || 0) >= 5,
        rewards: { wood: 100, clay: 100, iron: 100 }
    },
    {
        id: "Q_ATTACK_BARBARIAN",
        title: "O Primeiro Saque",
        description: "Envie seus Lanceiros pelo mapa para atacar e saquear uma Aldeia Bárbara!",
        prerequisites: ["Q_RECRUIT_5_SPEAR"],
        checkCondition: async (village, prisma) => {
            const report = await prisma.combatReport.findFirst({
                where: { attackerId: village.userId }
            });
            return !!report;
        },
        rewards: { wood: 500, clay: 500, iron: 500 }
    },
    {
        id: "Q_EXPANSION",
        title: "O Nobre Colonizador",
        description: "A hora chegou. Reúna seus colonos e estabeleça a sua Segunda Aldeia! (Duração da Fundação: 7 Dias)",
        prerequisites: ["Q_ATTACK_BARBARIAN"],
        checkCondition: () => true, // Instantaneamente resgatável assim que disponível
        rewards: { wood: 0, clay: 0, iron: 0 } // Recompensa mecânica lidada no claim
    }
]

export default async function questRoutes(fastify: FastifyInstance, opts: { prisma: PrismaClient }) {
    const { prisma } = opts

    // Listar missões do jogador
    fastify.get('/quests', { preValidation: [fastify.authenticate] }, async (request, reply) => {
        const user = (request as any).user
        if (!user) return reply.code(401).send({ error: 'Não autorizado' })

        const village = await prisma.village.findFirst({
            where: { userId: user.id },
            include: { buildings: true, units: true }
        })

        if (!village) return reply.code(404).send({ error: 'Aldeia não encontrada' })

        const userQuests = await prisma.userQuest.findMany({
            where: { userId: user.id }
        })

        const claimedSet = new Set(userQuests.filter(q => q.claimed).map(q => q.questId))

        const result = []

        for (const q of QUESTS) {
            // Verifica se todos os pré-requisitos foram resgatados
            const hasPrerequisites = q.prerequisites.every(pre => claimedSet.has(pre))
            
            if (hasPrerequisites) {
                const dbQuest = userQuests.find(uq => uq.questId === q.id)
                // Se ainda não salvou no DB que concluiu, testar em tempo real
                const isCompleted = dbQuest?.completed || (await q.checkCondition(village, prisma))
                
                result.push({
                    id: q.id,
                    title: q.title,
                    description: q.description,
                    rewards: q.rewards,
                    completed: isCompleted,
                    claimed: dbQuest?.claimed || false
                })
            }
        }

        return { quests: result }
    })

    // Helper para gerar numeral romano
    const toRoman = (num: number) => {
        const lookup = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
        let roman = '';
        for (let i in lookup) {
            // @ts-ignore
            while ( num >= lookup[i] ) {
                roman += i;
                // @ts-ignore
                num -= lookup[i];
            }
        }
        return roman;
    }

    // Reivindicar recompensa
    fastify.post('/quests/:questId/claim', { preValidation: [fastify.authenticate] }, async (request, reply) => {
        const user = (request as any).user
        if (!user) return reply.code(401).send({ error: 'Não autorizado' })

        const { questId } = request.params as { questId: string }
        const questDef = QUESTS.find(q => q.id === questId)

        if (!questDef) return reply.code(404).send({ error: 'Missão não existe' })

        const userQuests = await prisma.userQuest.findMany({
            where: { userId: user.id }
        })

        const claimedSet = new Set(userQuests.filter(q => q.claimed).map(q => q.questId))
        const hasPrerequisites = questDef.prerequisites.every(pre => claimedSet.has(pre))
        
        if (!hasPrerequisites) {
            return reply.code(400).send({ error: 'Pré-requisitos não cumpridos para esta missão.' })
        }

        const village = await prisma.village.findFirst({
            where: { userId: user.id },
            include: { buildings: true, resources: true, units: true }
        })

        if (!village) return reply.code(404).send({ error: 'Aldeia não encontrada' })

        const isCompletedNow = await questDef.checkCondition(village, prisma)
        if (!isCompletedNow) {
            return reply.code(400).send({ error: 'Você não cumpriu os requisitos desta missão ainda.' })
        }

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

                // Lógica Especial da Segunda Aldeia
                if (questId === "Q_EXPANSION") {
                    // Descobrir quantas aldeias o usuário já tem
                    const userVillagesCount = await tx.village.count({ where: { userId: user.id } });
                    
                    // Achar um quadrado vazio a uma distância de 2 a 5 da primária
                    let newX = village.x;
                    let newY = village.y;
                    let found = false;
                    
                    for (let attempt = 0; attempt < 50; attempt++) {
                        const r = Math.floor(Math.random() * 4) + 2; // Raio entre 2 e 5
                        const angle = Math.random() * Math.PI * 2;
                        const rx = Math.round(Math.cos(angle) * r);
                        const ry = Math.round(Math.sin(angle) * r);
                        
                        const tryX = village.x + rx;
                        const tryY = village.y + ry;
                        
                        if (tryX >= 0 && tryX <= 999 && tryY >= 0 && tryY <= 999) {
                            const occ = await tx.village.findUnique({ where: { x_y: { x: tryX, y: tryY } }});
                            if (!occ) {
                                newX = tryX;
                                newY = tryY;
                                found = true;
                                break;
                            }
                        }
                    }
                    
                    if (!found) throw new Error('Não há espaço no mapa para fundar sua aldeia!');
                    
                    const romanNum = toRoman(userVillagesCount + 1);
                    const newVillageName = `Aldeia de ${user.username} ${romanNum}`;

                    // Criamos a vila nova com Sede 0
                    const newVillage = await tx.village.create({
                        data: {
                            name: newVillageName,
                            userId: user.id,
                            x: newX,
                            y: newY,
                            resources: { create: { wood: 500, clay: 500, iron: 500 } },
                            buildings: { create: { headquarters: 0 } }, // Sede Nível 0
                            units: { create: {} },
                            boosters: {
                                create: {
                                    boosterType: 'SHIELD',
                                    multiplier: 1.0,
                                    endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 dias
                                }
                            }
                        }
                    });

                    // Inserimos a fila de construção de 7 dias
                    // Date.now() + 7 dias em ms
                    const seteDiasEmMs = 7 * 24 * 60 * 60 * 1000;
                    await tx.buildingQueue.create({
                        data: {
                            villageId: newVillage.id,
                            buildingType: 'headquarters',
                            targetLevel: 1,
                            endTime: new Date(Date.now() + seteDiasEmMs)
                        }
                    });

                } else {
                    // Dar recursos normais
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
                }
            })

            return { message: 'Recompensa resgatada com sucesso!' }
        } catch (e: any) {
            return reply.code(400).send({ error: e.message })
        }
    })
}
