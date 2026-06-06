import Fastify from 'fastify'
import cors from '@fastify/cors'
import { gerarCoordenadaSpawn } from './utils/spawn'
import { atualizarEstadoAldeia } from './gameLogic/villageState'
import { obterServerConfigCached } from './utils/serverConfigCache'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'
import dns from 'node:dns'

dns.setDefaultResultOrder('ipv4first')

// Validação antecipada das variáveis de ambiente obrigatórias.
// Falhar aqui é intencional: melhor uma mensagem clara na inicialização
// do que um erro críptico do driver pg em tempo de execução.
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
    console.error('[ERRO FATAL] A variável de ambiente DATABASE_URL não está definida.')
    process.exit(1)
}

// A URL do serviço de IA do Conselheiro é configurável por ambiente,
// permitindo apontar para instâncias diferentes em dev/produção.
const conselheiroUrl = process.env.CONSELHEIRO_URL
if (!conselheiroUrl) {
    console.error('[ERRO FATAL] A variável de ambiente CONSELHEIRO_URL não está definida.')
    process.exit(1)
}

import fastifyJwt from '@fastify/jwt'
import authRoutes from './routes/auth'
import adminRoutes from './routes/admin'
import questRoutes from './routes/quests'

declare module 'fastify' {
    export interface FastifyInstance {
        authenticate: any
    }
}

const fastify = Fastify({ logger: true })

fastify.setErrorHandler((error, request, reply) => {
    // Se o erro for uma falha de validação gerada pelo Fastify ou similar
    if (error.statusCode && error.statusCode < 500) {
        return reply.code(error.statusCode).send({ error: error.message })
    }

    // Falhas de banco de dados ou exceções inesperadas geram 500
    if (process.env.NODE_ENV !== 'production') {
        fastify.log.error(error)
        return reply.code(500).send({ error: error.message, stack: error.stack })
    } else {
        // Em produção, escondemos os detalhes do erro
        fastify.log.error(error.message)
        return reply.code(500).send({ error: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.' })
    }
})

const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

import fastifyRateLimit from '@fastify/rate-limit'

fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
})

fastify.register(fastifyRateLimit, {
    max: 100, // global limit
    timeWindow: '1 minute'
})

fastify.addHook('preHandler', async (request, reply) => {
    // Rotas de autenticação ou leitura não restrita não devem ser totalmente bloqueadas para admins tentarem logar
    if (request.routerPath?.startsWith('/auth/')) return

    const config = await obterServerConfigCached(prisma)
    if (config?.maintenanceMode) {
        // Permitir admins de continuar
        try {
            await request.jwtVerify()
            const user = request.user as { role: string }
            if (user.role === 'ADMIN') return
        } catch {
            // Se não tá logado, bloqueia
        }
        return reply.code(503).send({ error: 'O servidor está em manutenção no momento. Tente novamente mais tarde.' })
    }
})

fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret_ygp_kast_key'
})

fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
        await request.jwtVerify()
    } catch (err) {
        reply.code(401).send({ error: 'Acesso negado. Token inválido ou ausente.' })
    }
})

fastify.register(authRoutes, { prisma })
fastify.register(adminRoutes, { prisma })
fastify.register(questRoutes, { prisma })

fastify.get('/me/villages', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string, username: string, role?: string }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })

    const villages = await prisma.village.findMany({
        where: { userId: user.id },
        include: { resources: true, buildings: true, units: true }
    })

    if (villages.length === 0 && dbUser?.role !== 'ADMIN') {
        if (!dbUser?.isDefeated) {
            await prisma.user.update({ where: { id: user.id }, data: { isDefeated: true } })
        }
        const config = await obterServerConfigCached(prisma)
        return { villages: [], isDefeated: true, globalMessage: config?.globalMessage || null, role: dbUser?.role, serverSpeed: config?.speedMultiplier || 1.0 }
    }

    const config = await obterServerConfigCached(prisma)

    return { 
        villages, 
        globalMessage: config?.globalMessage || null,
        role: user.role,
        isDefeated: dbUser?.isDefeated || false,
        serverSpeed: config?.speedMultiplier || 1.0
    }
})

fastify.post('/village/:id/market/send', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { targetId, wood, clay, iron } = request.body as { targetId: string, wood: number, clay: number, iron: number }

    if (!targetId || targetId === id) {
        return reply.code(400).send({ error: 'Destino inválido.' })
    }

    const sendWood = Math.max(0, parseInt(wood as any) || 0)
    const sendClay = Math.max(0, parseInt(clay as any) || 0)
    const sendIron = Math.max(0, parseInt(iron as any) || 0)
    const totalAmount = sendWood + sendClay + sendIron

    if (totalAmount <= 0) {
        return reply.code(400).send({ error: 'Você deve enviar pelo menos um recurso.' })
    }

    const result = await prisma.$transaction(async (tx) => {
        const origin = await tx.village.findFirst({
            where: { id, userId: user.id },
            include: { resources: true, buildings: true }
        })

        if (!origin || !origin.resources || !origin.buildings) {
            throw new Error('NOT_FOUND_OR_NOT_OWNER')
        }

        const target = await tx.village.findUnique({ where: { id: targetId } })
        if (!target) {
            throw new Error('TARGET_NOT_FOUND')
        }

        const marketLevel = (origin.buildings as any).market || 0
        if (marketLevel <= 0) {
            throw new Error('NO_MARKET')
        }

        const { getMarketCapacity } = require('./gameLogic/economy')
        const totalCapacity = getMarketCapacity(marketLevel)
        
        // Calcular mercadores em trânsito (ida e volta)
        const pendingTransports = await tx.movement.findMany({
            where: { originId: id, type: 'TRANSPORT', completed: false }
        })
        const pendingReturns = await tx.movement.findMany({
            where: { targetId: id, type: 'TRANSPORT_RETURN', completed: false }
        })
        
        const inTransitOut = pendingTransports.reduce((sum: number, t: any) => sum + (t.wood || 0) + (t.clay || 0) + (t.iron || 0), 0)
        const inTransitReturn = pendingReturns.reduce((sum: number, t: any) => sum + (t.wood || 0) + (t.clay || 0) + (t.iron || 0), 0)
        const inTransitAmount = inTransitOut + inTransitReturn
        
        const availableCapacity = totalCapacity - inTransitAmount

        if (totalAmount > availableCapacity) {
            throw new Error('INSUFFICIENT_MERCHANTS')
        }

        if (origin.resources.wood < sendWood || origin.resources.clay < sendClay || origin.resources.iron < sendIron) {
            throw new Error('INSUFFICIENT_RESOURCES')
        }

        // Deduct resources
        await tx.villageResource.update({
            where: { villageId: id },
            data: {
                wood: { decrement: sendWood },
                clay: { decrement: sendClay },
                iron: { decrement: sendIron }
            }
        })

        // Calcular tempo (simulando que mercadores andam a 6 minutos por bloco - 360s)
        const dist = Math.sqrt(Math.pow(origin.x - target.x, 2) + Math.pow(origin.y - target.y, 2))
        const serverConfig = await tx.serverConfig.findFirst()
        const speed = serverConfig?.speedMultiplier || 1.0
        
        const timeSec = Math.max(10, Math.floor((dist * 360) / speed))
        const arrivalTime = new Date(Date.now() + timeSec * 1000)

        const movement = await tx.movement.create({
            data: {
                type: 'TRANSPORT',
                originId: id,
                targetId: targetId,
                wood: sendWood,
                clay: sendClay,
                iron: sendIron,
                arrivalTime,
                completed: false
            }
        })

        return movement
    })

    return result
})

fastify.post('/me/restart', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string, username: string }
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    
    if (!dbUser?.isDefeated) {
        return reply.code(400).send({ error: 'Você não está derrotado para recomeçar.' })
    }

    const { region } = (request.body as any) || {}
    const coords = await gerarCoordenadaSpawn(prisma, region || 'ALEATORIO')

    if (!coords) {
        return reply.code(500).send({ error: 'Não foi possível encontrar lugar seguro para sua nova aldeia.' })
    }
    const { x, y } = coords

    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: user.id },
            data: { isDefeated: false }
        })

        await tx.village.create({
            data: {
                name: `Nova Aldeia de ${user.username}`,
                x,
                y,
                userId: user.id,
                resources: { create: { wood: 500, clay: 500, iron: 500 } },
                buildings: { create: {} },
                units: { create: {} }
            }
        })
    })

    // Spawn 1 barbara
    setTimeout(async () => {
        let created = false
        for (let tentativa = 0; tentativa < 5 && !created; tentativa++) {
            const bx = Math.max(0, Math.min(999, x + Math.floor(Math.random() * 5) - 2))
            const by = Math.max(0, Math.min(999, y + Math.floor(Math.random() * 5) - 2))
            if (bx === x && by === y) continue;
            const exists = await prisma.village.findUnique({ where: { x_y: { x: bx, y: by } } })
            if (!exists) {
                await prisma.village.create({
                    data: {
                        name: `Aldeia Bárbara`,
                        x: bx,
                        y: by,
                        userId: null,
                        resources: { create: { wood: 300, clay: 300, iron: 300 } },
                        buildings: { create: { timberCamp: 1, clayPit: 1, ironMine: 1 } },
                        units: { create: {} }
                    }
                })
                created = true
            }
        }
    }, 50)

    return { message: 'Você renasceu com uma nova aldeia!' }
})

fastify.get('/map', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { minX = 0, maxX = 999, minY = 0, maxY = 999 } = request.query as any

    const numMinX = Number(minX)
    const numMaxX = Number(maxX)
    const numMinY = Number(minY)
    const numMaxY = Number(maxY)

    const { calculatePoints } = require('./gameLogic/economy')

    const rawVillages = await prisma.village.findMany({
        where: {
            x: { gte: numMinX, lte: numMaxX },
            y: { gte: numMinY, lte: numMaxY }
        },
        select: { 
            id: true, 
            name: true, 
            x: true, 
            y: true, 
            userId: true,
            user: { select: { username: true } },
            buildings: true
        }
    })

    const villages = rawVillages.map((v: any) => ({
        id: v.id,
        name: v.name,
        x: v.x,
        y: v.y,
        userId: v.userId,
        username: v.user?.username || null,
        points: calculatePoints(v.buildings)
    }))

    const user = request.user as { id: string }

    const movements = await prisma.movement.findMany({
        where: { 
            completed: false,
            OR: [
                { origin: { userId: user.id }, type: { not: 'RETURN' } },
                { target: { userId: user.id } }
            ]
        },
        include: {
            origin: { select: { x: true, y: true } },
            target: { select: { x: true, y: true } }
        }
    })

    return { villages, movements }
})

fastify.get('/map/search', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    let { q } = request.query as any
    if (!q || typeof q !== 'string') return reply.code(400).send({ error: 'Termo de busca vazio.' })
    
    q = q.trim()
    if (!q) return reply.code(400).send({ error: 'Termo de busca vazio.' })
    
    // Busca por nome exato ou contendo
    const village = await prisma.village.findFirst({
        where: { name: { contains: q, mode: 'insensitive' } },
        select: { x: true, y: true }
    })

    if (!village) return reply.code(404).send({ error: 'Aldeia não encontrada.' })
    
    return village
})

import { getUnitStats, getRecruitTime } from './gameLogic/unitEconomy'

fastify.post('/village/recruit', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { villageId, unitType, amount } = request.body as { villageId: string, unitType: string, amount: number }

    if (amount <= 0) return reply.code(400).send({ error: 'Quantidade inválida.' })

    const village = await prisma.village.findFirst({
        where: { id: villageId, userId: user.id },
        include: { units: true, resources: true, buildings: true }
    })

    if (!village || !village.units || !village.resources || !village.buildings) {
        return reply.code(404).send({ error: 'Aldeia não encontrada ou incompleta.' })
    }

    const stats = getUnitStats(unitType)
    if (!stats) return reply.code(400).send({ error: 'Unidade inválida.' })

    if ((village.buildings.barracks || 0) < 1) {
        return reply.code(400).send({ error: 'Quartel não construído.' })
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Village" WHERE id = ${villageId} FOR UPDATE`

            const agora = new Date()
            await atualizarEstadoAldeia(tx, villageId, agora)

            const { getFarmCapacity, getTotalUsedPopulation } = require('./gameLogic/economy')
            const maxPop = getFarmCapacity(village.buildings.farm || 0)
            
            const currentPop = await getTotalUsedPopulation(tx, villageId)
            const requestedPop = amount * (stats.population || 1)
            
            if (currentPop + requestedPop > maxPop) {
                throw new Error('INSUFFICIENT_POPULATION')
            }

            const cost = {
                wood: stats.cost.wood * amount,
                clay: stats.cost.clay * amount,
                iron: stats.cost.iron * amount
            }

            const resourceUpdate = await tx.villageResource.updateMany({
                where: { 
                    villageId,
                    wood: { gte: cost.wood },
                    clay: { gte: cost.clay },
                    iron: { gte: cost.iron }
                },
                data: {
                    wood: { decrement: cost.wood },
                    clay: { decrement: cost.clay },
                    iron: { decrement: cost.iron }
                }
            })

            if (resourceUpdate.count === 0) {
                throw new Error('INSUFFICIENT_RESOURCES')
            }

            const lastQueue = await tx.unitQueue.findFirst({
                where: { villageId, completed: false },
                orderBy: { endTime: 'desc' }
            })

            const startTime = lastQueue ? new Date(lastQueue.endTime) : new Date()
            
            const config = await tx.serverConfig.findFirst()
            const speedMultiplier = config?.speedMultiplier || 1.0
            
            let recruitTimeSec = getRecruitTime(unitType, amount, village.buildings!.barracks)
            recruitTimeSec = Math.max(1, Math.floor(recruitTimeSec / speedMultiplier))
            
            const endTime = new Date(startTime.getTime() + recruitTimeSec * 1000)

            await tx.unitQueue.create({
                data: {
                    villageId,
                    unitType,
                    amount,
                    startTime,
                    endTime
                }
            })
        })
    } catch (erro: any) {
        if (erro.message === 'INSUFFICIENT_RESOURCES') {
            return reply.code(400).send({ error: 'Recursos insuficientes. Você não possui os materiais ou houve alteração concorrente.' })
        }
        if (erro.message === 'INSUFFICIENT_POPULATION') {
            return reply.code(400).send({ error: 'População insuficiente. Evolua sua Fazenda.' })
        }
        throw erro
    }

    return { message: 'Recrutamento enviado para a fila' }
})


fastify.post('/village/attack', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const body = request.body as any
    const { originId, targetId } = body

    if (originId === targetId) {
        return reply.code(400).send({ error: 'Comando inválido: A aldeia de origem e destino não podem ser a mesma.' })
    }

    // Sanitização de entradas numéricas
    const spear = Math.max(0, Math.floor(Number(body.spear) || 0))
    const sword = Math.max(0, Math.floor(Number(body.sword) || 0))
    const axe = Math.max(0, Math.floor(Number(body.axe) || 0))

    if (spear + sword + axe <= 0) {
        return reply.code(400).send({ error: 'Você deve enviar pelo menos uma tropa.' })
    }

    const origin = await prisma.village.findFirst({
        where: { id: originId, userId: user.id },
        select: { id: true, x: true, y: true }
    })

    const target = await prisma.village.findUnique({ where: { id: targetId } })

    if (!origin || !target) return reply.code(400).send({ error: 'Aldeia de origem ou destino inválida.' })

    // Deduz tropas de forma atômica prevenindo condições de corrida
    try {
        await prisma.$transaction(async (tx) => {
            const updateResult = await tx.villageUnit.updateMany({
                where: { 
                    villageId: origin.id,
                    spear: { gte: spear },
                    sword: { gte: sword },
                    axe: { gte: axe }
                },
                data: {
                    spear: { decrement: spear },
                    sword: { decrement: sword },
                    axe: { decrement: axe }
                }
            })

            if (updateResult.count === 0) {
                throw new Error('INSUFFICIENT_TROOPS')
            }

            // Calcula a distância: √( (x2-x1)² + (y2-y1)² )
            const dx = target.x - origin.x
            const dy = target.y - origin.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            const config = await tx.serverConfig.findFirst()
            const speedMultiplier = config?.speedMultiplier || 1.0

            const { UNIT_STATS } = require('./gameLogic/unitEconomy')
            
            // Encontrar a velocidade da tropa mais lenta entre as enviadas
            let maxSpeedSec = 0
            if (spear > 0) maxSpeedSec = Math.max(maxSpeedSec, UNIT_STATS.spear.speedSecPerBlock)
            if (sword > 0) maxSpeedSec = Math.max(maxSpeedSec, UNIT_STATS.sword.speedSecPerBlock)
            if (axe > 0) maxSpeedSec = Math.max(maxSpeedSec, UNIT_STATS.axe.speedSecPerBlock)

            if (maxSpeedSec === 0) maxSpeedSec = 1800 // Fallback genérico caso falhe (30 min)

            // Tempo total: Distância Euclidiana * Segundos por Bloco / SpeedGlobal
            let tempoViagemMs = Math.round((distance * maxSpeedSec * 1000) / speedMultiplier)

            // Buff de Velocidade contra Aldeias Bárbaras (Sem Dono)
            if (target.userId === null) {
                tempoViagemMs = Math.round(tempoViagemMs / 5)
            }

            // Impede que o tempo seja menor que 1 segundo
            const arrivalTime = new Date(Date.now() + Math.max(1000, tempoViagemMs))

            await tx.movement.create({
                data: {
                    type: 'ATTACK',
                    originId,
                    targetId,
                    spear, sword, axe,
                    arrivalTime
                }
            })
        })
    } catch (erro: any) {
        if (erro.message === 'INSUFFICIENT_TROOPS') {
            return reply.code(400).send({ error: 'Você não tem essa quantidade de tropas ou elas já foram despachadas.' })
        }
        throw erro
    }

    return { message: 'Ataque enviado com sucesso!' }
})

fastify.post('/village/support', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const body = request.body as any
    const { originId, targetId } = body

    if (originId === targetId) {
        return reply.code(400).send({ error: 'Comando inválido: A aldeia de origem e destino não podem ser a mesma.' })
    }

    const spear = Math.max(0, Math.floor(Number(body.spear) || 0))
    const sword = Math.max(0, Math.floor(Number(body.sword) || 0))
    const axe = Math.max(0, Math.floor(Number(body.axe) || 0))

    if (spear + sword + axe <= 0) {
        return reply.code(400).send({ error: 'Você deve enviar pelo menos uma tropa de apoio.' })
    }

    const origin = await prisma.village.findFirst({
        where: { id: originId, userId: user.id },
        select: { id: true, x: true, y: true }
    })

    const target = await prisma.village.findUnique({ where: { id: targetId } })

    if (!origin || !target) return reply.code(400).send({ error: 'Aldeia de origem ou destino inválida.' })

    try {
        await prisma.$transaction(async (tx) => {
            const updateResult = await tx.villageUnit.updateMany({
                where: { 
                    villageId: origin.id,
                    spear: { gte: spear },
                    sword: { gte: sword },
                    axe: { gte: axe }
                },
                data: {
                    spear: { decrement: spear },
                    sword: { decrement: sword },
                    axe: { decrement: axe }
                }
            })

            if (updateResult.count === 0) {
                throw new Error('INSUFFICIENT_TROOPS')
            }

            const dx = target.x - origin.x
            const dy = target.y - origin.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            const config = await tx.serverConfig.findFirst()
            const speedMultiplier = config?.speedMultiplier || 1.0

            let tempoViagemMs = Math.round((distance * 30000) / speedMultiplier)
            const arrivalTime = new Date(Date.now() + Math.max(1000, tempoViagemMs))

            await tx.movement.create({
                data: {
                    type: 'SUPPORT',
                    originId,
                    targetId,
                    spear, sword, axe,
                    arrivalTime
                }
            })
        })
    } catch (erro: any) {
        if (erro.message === 'INSUFFICIENT_TROOPS') {
            return reply.code(400).send({ error: 'Você não tem essa quantidade de tropas.' })
        }
        throw erro
    }

    return { message: 'Apoio enviado com sucesso!' }
})

fastify.post('/village/support/recall', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { supportId } = request.body as { supportId: string }

    const support = await prisma.supportingTroop.findFirst({
        where: { id: supportId, owner: { userId: user.id } },
        include: { target: true, owner: true }
    })

    if (!support) return reply.code(404).send({ error: 'Apoio não encontrado ou não pertence a você.' })

    const dx = support.target.x - support.owner.x
    const dy = support.target.y - support.owner.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    const config = await obterServerConfigCached(prisma)
    const speedMultiplier = config?.speedMultiplier || 1.0
    let tempoViagemMs = Math.round((distance * 30000) / speedMultiplier)
    const arrivalTime = new Date(Date.now() + Math.max(1000, tempoViagemMs))

    await prisma.$transaction(async (tx) => {
        await tx.supportingTroop.delete({ where: { id: supportId } })
        
        await tx.movement.create({
            data: {
                type: 'RETURN',
                originId: support.targetId,
                targetId: support.ownerId,
                spear: support.spear,
                sword: support.sword,
                axe: support.axe,
                arrivalTime
            }
        })
    })

    return { message: 'Tropas chamadas de volta.' }
})

fastify.post('/village/support/send-back', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { supportId } = request.body as { supportId: string }

    const support = await prisma.supportingTroop.findFirst({
        where: { id: supportId, target: { userId: user.id } },
        include: { target: true, owner: true }
    })

    if (!support) return reply.code(404).send({ error: 'Apoio não encontrado na sua aldeia.' })

    const dx = support.target.x - support.owner.x
    const dy = support.target.y - support.owner.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    const config = await obterServerConfigCached(prisma)
    const speedMultiplier = config?.speedMultiplier || 1.0
    let tempoViagemMs = Math.round((distance * 30000) / speedMultiplier)
    const arrivalTime = new Date(Date.now() + Math.max(1000, tempoViagemMs))

    await prisma.$transaction(async (tx) => {
        await tx.supportingTroop.delete({ where: { id: supportId } })
        
        await tx.movement.create({
            data: {
                type: 'RETURN',
                originId: support.targetId,
                targetId: support.ownerId,
                spear: support.spear,
                sword: support.sword,
                axe: support.axe,
                arrivalTime
            }
        })
    })

    return { message: 'Tropas devolvidas ao dono.' }
})

fastify.get('/reports', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const reports = await prisma.combatReport.findMany({
        where: {
            OR: [
                { attackerId: user.id },
                { defenderId: user.id }
            ]
        },
        orderBy: { createdAt: 'desc' }
    })
    
    const safeReports = reports.map((report: any) => {
        if (report.attackerId === user.id && report.result === 'DEFENDER_WON') {
            return {
                ...report,
                defSpear: -1,
                defSword: -1,
                defAxe: -1,
                defLostSpear: -1,
                defLostSword: -1,
                defLostAxe: -1
            }
        }
        return report
    })

    return safeReports
})

import { getBuildingCost, getMarketCapacity } from './gameLogic/economy'

fastify.post('/village/build', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { villageId, buildingType } = request.body as { villageId: string, buildingType: string }

    const BUILDINGS_VALIDOS = ['headquarters', 'timberCamp', 'clayPit', 'ironMine', 'farm', 'warehouse', 'barracks', 'market', 'wall', 'church']
    if (!BUILDINGS_VALIDOS.includes(buildingType)) {
        return reply.code(400).send({ error: 'Edifício inválido.' })
    }

    const village = await prisma.village.findFirst({
        where: { id: villageId, userId: user.id },
        include: { buildings: true, resources: true, buildQueues: { where: { completed: false }, orderBy: { endTime: 'desc' } } }
    })

    if (!village || !village.buildings || !village.resources) {
        return reply.code(404).send({ error: 'Aldeia não encontrada ou não pertence a você.' })
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Village" WHERE id = ${villageId} FOR UPDATE`

            const agora = new Date()
            await atualizarEstadoAldeia(tx, villageId, agora)

            const { getFarmCapacity, MAX_LEVELS, getBuildingPopCost, getTotalUsedPopulation } = require('./gameLogic/economy')

            const activeBuilds = await tx.buildingQueue.findMany({
                where: { villageId, buildingType, completed: false }
            })
            
            const currentBldgs = await tx.villageBuilding.findUnique({
                where: { villageId }
            })
            
            const currentLevel = currentBldgs ? (currentBldgs as any)[buildingType] || 0 : 0
            const newLevel = currentLevel + activeBuilds.length + 1
            
            if (newLevel > (MAX_LEVELS[buildingType] || 25)) {
                throw new Error('MAX_LEVEL')
            }
            
            const maxPop = getFarmCapacity(currentBldgs ? (currentBldgs as any).farm || 0 : 0)
            const popIncrease = getBuildingPopCost(buildingType, newLevel) - getBuildingPopCost(buildingType, newLevel - 1)
            
            if (popIncrease > 0) {
                const currentPop = await getTotalUsedPopulation(tx, villageId)
                if (currentPop + popIncrease > maxPop) {
                    throw new Error('INSUFFICIENT_POPULATION')
                }
            }

            const cost = getBuildingCost(buildingType, newLevel)

            const resourceUpdate = await tx.villageResource.updateMany({
                where: { 
                    villageId,
                    wood: { gte: cost.wood },
                    clay: { gte: cost.clay },
                    iron: { gte: cost.iron }
                },
                data: {
                    wood: { decrement: cost.wood },
                    clay: { decrement: cost.clay },
                    iron: { decrement: cost.iron }
                }
            })

            if (resourceUpdate.count === 0) {
                throw new Error('INSUFFICIENT_RESOURCES')
            }

            const lastBuild = await tx.buildingQueue.findFirst({
                where: { villageId, completed: false },
                orderBy: { endTime: 'desc' }
            })

            const startTime = lastBuild ? new Date(lastBuild.endTime) : new Date()

            const config = await tx.serverConfig.findFirst()
            const speedMultiplier = config?.speedMultiplier || 1.0

            let buildTimeSec = cost.timeSec
            buildTimeSec = Math.max(1, Math.floor(buildTimeSec / speedMultiplier))

            const endTime = new Date(startTime.getTime() + buildTimeSec * 1000)

            await tx.buildingQueue.create({
                data: {
                    villageId,
                    buildingType,
                    targetLevel: newLevel,
                    startTime,
                    endTime
                }
            })
        })
    } catch (erro: any) {
        if (erro.message === 'INSUFFICIENT_RESOURCES') {
            return reply.code(400).send({ error: 'Recursos insuficientes. Tentativa de concorrência detectada.' })
        }
        if (erro.message === 'MAX_LEVEL') {
            return reply.code(400).send({ error: 'Nível máximo atingido.' })
        }
        if (erro.message === 'INSUFFICIENT_POPULATION') {
            return reply.code(400).send({ error: 'População insuficiente para construir. Evolua sua Fazenda.' })
        }
        fastify.log.error({ erro }, 'Erro ao iniciar construção')
        return reply.code(500).send({ error: erro.message || 'Erro ao iniciar construção' })
    }
})

fastify.get('/village/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as { id: string }

    fastify.log.info(`Requisição: GET /village/${id} — buscando aldeia de forma otimizada`)

    try {
        const agora = new Date()

        // 1. Sincroniza e consolida a economia atômica passando o cliente prisma (sem transação interativa desnecessária)
        const villageState = await atualizarEstadoAldeia(prisma, id, agora)

        if (villageState.userId !== user.id) {
            fastify.log.warn(`Acesso não autorizado: Usuário ${user.id} tentando acessar aldeia ${id}`)
            return reply.code(403).send({ error: 'Você não tem permissão para acessar esta aldeia.' })
        }

        // 2. Busca todos os outros dados dependentes da aldeia em paralelo (1x RTT no banco)
        const [
            movementsOrigin,
            movementsTarget,
            supportingSent,
            supportingReceived,
            activeQueue,
            activeUnitQueue,
            activeBoosters,
            config
        ] = await Promise.all([
            prisma.movement.findMany({
                where: { originId: id, completed: false, type: { not: 'RETURN' } },
                include: { target: { select: { name: true, x: true, y: true, userId: true, user: { select: { username: true } } } } }
            }),
            prisma.movement.findMany({
                where: { targetId: id, completed: false },
                include: { origin: { select: { name: true, x: true, y: true, userId: true, user: { select: { username: true } } } } }
            }),
            prisma.supportingTroop.findMany({
                where: { ownerId: id },
                include: { target: { select: { name: true, x: true, y: true } } }
            }),
            prisma.supportingTroop.findMany({
                where: { targetId: id },
                include: { owner: { select: { name: true, x: true, y: true, user: { select: { username: true } } } } }
            }),
            prisma.buildingQueue.findMany({
                where: { villageId: id, completed: false },
                orderBy: { endTime: 'asc' }
            }),
            prisma.unitQueue.findMany({
                where: { villageId: id, completed: false },
                orderBy: { endTime: 'asc' }
            }),
            prisma.villageBooster.findMany({
                where: { villageId: id, endTime: { gt: agora } }
            }),
            obterServerConfigCached(prisma)
        ])

        const speedMultiplier = config?.speedMultiplier || 1.0

        let woodMultiplier = speedMultiplier
        let clayMultiplier = speedMultiplier
        let ironMultiplier = speedMultiplier

        for (const booster of activeBoosters) {
            if (booster.boosterType === 'ALL_RESOURCES') {
                woodMultiplier *= booster.multiplier
                clayMultiplier *= booster.multiplier
                ironMultiplier *= booster.multiplier
            } else if (booster.boosterType === 'WOOD_PRODUCTION') {
                woodMultiplier *= booster.multiplier
            } else if (booster.boosterType === 'CLAY_PRODUCTION') {
                clayMultiplier *= booster.multiplier
            } else if (booster.boosterType === 'IRON_PRODUCTION') {
                ironMultiplier *= booster.multiplier
            }
        }

        return { 
            ...villageState, 
            movementsOrigin,
            movementsTarget,
            supportingSent,
            supportingReceived,
            activeQueue,
            activeUnitQueue,
            activeMultipliers: { wood: woodMultiplier, clay: clayMultiplier, iron: ironMultiplier } 
        }

    } catch (error: any) {
        fastify.log.error({ msg: error.message, stack: error.stack }, `Erro ao buscar aldeia ${id}`)
        return reply.code(500).send({ error: 'Não foi possível carregar a aldeia. Tente novamente em instantes.' })
    }
})

fastify.post('/conselheiro', async (request, reply) => {
    const body = request.body as { pergunta?: string }

    // Valida a presença e o conteúdo da pergunta antes de consultar o serviço externo.
    if (!body?.pergunta || body.pergunta.trim() === '') {
        return reply.code(400).send({ error: 'O campo "pergunta" é obrigatório e não pode estar vazio.' })
    }

    const pergunta = body.pergunta.trim()
    fastify.log.info('Requisição: POST /conselheiro — pergunta recebida')

    try {
        const response = await fetch(conselheiroUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pergunta })
        })

        if (!response.ok) {
            fastify.log.error(`Falha na comunicação com o serviço do Conselheiro — status HTTP ${response.status}`)
            return reply.code(502).send({ error: `O serviço do Conselheiro retornou um erro (HTTP ${response.status}). Tente novamente.` })
        }

        const data = await response.json() as { resultado: string }
        fastify.log.info('Resposta do Conselheiro recebida com sucesso')
        return { resposta: data.resultado }

    } catch (error) {
        // Distingue erro de rede (serviço inacessível) de outros erros inesperados.
        const mensagem = error instanceof Error && error.message.includes('fetch')
            ? 'Não foi possível alcançar o serviço do Conselheiro. Verifique se ele está em execução.'
            : 'O Conselheiro encontrou um problema inesperado. Tente novamente em instantes.'

        fastify.log.error({ error }, 'Erro ao consultar o Conselheiro')
        return reply.code(503).send({ error: mensagem })
    }
})

const iniciarServidor = async () => {
    const portaDesejada = Number(process.env.PORT)
    // Se PORT não for um número válido, usa 8080 como padrão seguro.
    const portaInicial = Number.isNaN(portaDesejada) ? 8080 : portaDesejada
    let portaAtual = portaInicial
    const tentativasMax = 10

    for (let tentativa = 0; tentativa < tentativasMax; tentativa++) {
        try {
            await fastify.listen({ port: portaAtual, host: process.env.HOST || '127.0.0.1' })
            console.log('========================================')
            console.log('K.A.S.T. — Servidor iniciado (YGP)')
            console.log(`Backend: http://localhost:${portaAtual}`)
            console.log('Frontend: http://localhost:5173')
            console.log('========================================')
            return

        } catch (err) {
            if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
                const proximaPorta = portaAtual + 1
                const aviso = `Porta ${portaAtual} em uso. Tentando porta ${proximaPorta}...`
                console.warn(aviso)
                fastify.log.warn(aviso)
                portaAtual = proximaPorta
                continue
            }

            fastify.log.error({ err }, 'Erro fatal ao iniciar o servidor')
            console.error('Erro fatal ao iniciar o servidor:', err)
            process.exit(1)
        }
    }

    console.error(`[ERRO FATAL] Não foi possível iniciar o servidor após ${tentativasMax} tentativas.`)
    process.exit(1)
}

iniciarServidor()