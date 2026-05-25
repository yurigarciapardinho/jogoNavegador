import Fastify from 'fastify'
import cors from '@fastify/cors'
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

declare module 'fastify' {
    export interface FastifyInstance {
        authenticate: any
    }
}

const fastify = Fastify({ logger: true })

const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

fastify.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST']
})

fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret_ygp_tw2_clone_key'
})

fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
        await request.jwtVerify()
    } catch (err) {
        reply.code(401).send({ error: 'Acesso negado. Token inválido ou ausente.' })
    }
})

fastify.register(authRoutes, { prisma })

fastify.get('/me/villages', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string, username: string }
    
    const villages = await prisma.village.findMany({
        where: { userId: user.id },
        include: { resources: true, buildings: true, units: true }
    })
    
    return villages
})

fastify.get('/map', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const villages = await prisma.village.findMany({
        select: { id: true, name: true, x: true, y: true, userId: true }
    })

    const movements = await prisma.movement.findMany({
        where: { completed: false },
        include: {
            origin: { select: { x: true, y: true } },
            target: { select: { x: true, y: true } }
        }
    })

    return { villages, movements }
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

    const cost = {
        wood: stats.cost.wood * amount,
        clay: stats.cost.clay * amount,
        iron: stats.cost.iron * amount
    }

    if (village.resources.wood < cost.wood || village.resources.clay < cost.clay || village.resources.iron < cost.iron) {
        return reply.code(400).send({ error: 'Recursos insuficientes.' })
    }

    const lastQueue = await prisma.unitQueue.findFirst({
        where: { villageId, completed: false },
        orderBy: { endTime: 'desc' }
    })

    const startTime = lastQueue ? new Date(lastQueue.endTime) : new Date()
    const recruitTimeSec = getRecruitTime(unitType, amount, village.buildings.barracks)
    const endTime = new Date(startTime.getTime() + recruitTimeSec * 1000)

    try {
        await prisma.$transaction(async (tx) => {
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
        throw erro
    }

    return { message: 'Recrutamento enviado para a fila', cost, endTime }
})

fastify.post('/village/attack', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { originId, targetId, spear = 0, sword = 0, axe = 0 } = request.body as any

    const origin = await prisma.village.findFirst({
        where: { id: originId, userId: user.id },
        include: { units: true }
    })

    const target = await prisma.village.findUnique({ where: { id: targetId } })

    if (!origin || !origin.units || !target) return reply.code(400).send({ error: 'Aldeia de origem ou destino inválida.' })

    if (origin.units.spear < spear || origin.units.sword < sword || origin.units.axe < axe) {
        return reply.code(400).send({ error: 'Você não tem essa quantidade de tropas.' })
    }

    // Deduz tropas (em um projeto real deveria usar transaction)
    await prisma.villageUnit.update({
        where: { villageId: origin.id },
        data: {
            spear: origin.units.spear - spear,
            sword: origin.units.sword - sword,
            axe: origin.units.axe - axe
        }
    })

    const arrivalTime = new Date(Date.now() + 60000) // MVP: 1 minuto de viagem fixa

    const mov = await prisma.movement.create({
        data: {
            type: 'ATTACK',
            originId,
            targetId,
            spear, sword, axe,
            arrivalTime
        }
    })

    return mov
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
    return reports
})

import { getBuildingCost } from './gameLogic/economy'

fastify.post('/village/build', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string }
    const { villageId, buildingType } = request.body as { villageId: string, buildingType: string }

    const village = await prisma.village.findFirst({
        where: { id: villageId, userId: user.id },
        include: { buildings: true, resources: true, buildQueues: { where: { completed: false }, orderBy: { endTime: 'desc' } } }
    })

    if (!village || !village.buildings || !village.resources) {
        return reply.code(404).send({ error: 'Aldeia não encontrada ou não pertence a você.' })
    }

    const currentLevel = (village.buildings as any)[buildingType] || 0
    const newLevel = currentLevel + 1
    const cost = getBuildingCost(buildingType, newLevel)

    if (village.resources.wood < cost.wood || village.resources.clay < cost.clay || village.resources.iron < cost.iron) {
        return reply.code(400).send({ error: 'Recursos insuficientes.' })
    }

    // Calcula tempo
    const now = new Date()
    let startTime = now
    if (village.buildQueues && village.buildQueues.length > 0) {
        // Enfileira após a última construção
        startTime = new Date(village.buildQueues[0].endTime)
    }

    const endTime = new Date(startTime.getTime() + cost.timeSec * 1000)

    // Subtrai recursos e adiciona na fila numa transaction protegida (Atomic Update)
    try {
        await prisma.$transaction(async (tx) => {
            const resourceUpdate = await tx.villageResource.updateMany({
                where: { 
                    villageId: village.id,
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

            await tx.buildingQueue.create({
                data: {
                    villageId: village.id,
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
        throw erro
    }

    return { message: 'Construção enviada para a fila', cost, endTime }
})

fastify.get('/village/:id', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as { id: string }

    fastify.log.info(`Requisição: GET /village/${id} — buscando aldeia`)

    try {
        const village = await prisma.village.findUnique({
            where: { id, userId: user.id },
            include: { resources: true, buildings: true, units: true }
        })

        if (!village) {
            fastify.log.warn(`Aldeia não encontrada: ${id}`)
            return reply.code(404).send({ error: `Aldeia com id "${id}" não encontrada ou sem permissão.` })
        }

        if (!village.resources || !village.buildings) {
            fastify.log.warn(`Aldeia com dados incompletos no banco: ${id}`)
            return reply.code(500).send({ error: `A aldeia "${id}" existe mas está sem recursos ou construções. Execute o seed novamente.` })
        }

        const agora = new Date()
        
        // ---- Processar Filas de Construção Pendentes ----
        const completedQueues = await prisma.buildingQueue.findMany({
            where: {
                villageId: id,
                completed: false,
                endTime: { lte: agora }
            },
            orderBy: { endTime: 'asc' }
        })

        if (completedQueues.length > 0) {
            let buildingsToUpdate = { ...village.buildings } as any
            
            for (const q of completedQueues) {
                buildingsToUpdate[q.buildingType] = q.targetLevel
                
                await prisma.buildingQueue.update({
                    where: { id: q.id },
                    data: { completed: true }
                })
            }
            
            delete buildingsToUpdate.id
            delete buildingsToUpdate.villageId
            
            const updatedBuildings = await prisma.villageBuilding.update({
                where: { villageId: id },
                data: buildingsToUpdate
            })
            
            village.buildings = updatedBuildings
        }
        
        // Também buscar a fila não concluída para o frontend saber o que está rolando
        const activeQueue = await prisma.buildingQueue.findMany({
            where: { villageId: id, completed: false },
            orderBy: { endTime: 'asc' }
        })

        // ---- Processar Filas de Tropas Pendentes ----
        const completedUnitQueues = await prisma.unitQueue.findMany({
            where: {
                villageId: id,
                completed: false,
                endTime: { lte: agora }
            },
            orderBy: { endTime: 'asc' }
        })

        if (completedUnitQueues.length > 0) {
            let unitsToUpdate = { ...village.units } as any
            
            for (const q of completedUnitQueues) {
                unitsToUpdate[q.unitType] = (unitsToUpdate[q.unitType] || 0) + q.amount
                
                await prisma.unitQueue.update({
                    where: { id: q.id },
                    data: { completed: true }
                })
            }
            
            delete unitsToUpdate.id
            delete unitsToUpdate.villageId
            
            const updatedUnits = await prisma.villageUnit.update({
                where: { villageId: id },
                data: unitsToUpdate
            })
            
            village.units = updatedUnits
        }

        const activeUnitQueue = await prisma.unitQueue.findMany({
            where: { villageId: id, completed: false },
            orderBy: { endTime: 'asc' }
        })

        // ---- Processar Geração Passiva de Recursos ----
        const ultimaAtualizacao = new Date(village.resources.lastUpdate)
        const msMpassados = agora.getTime() - ultimaAtualizacao.getTime()
        const horasPassadas = msMpassados / (1000 * 60 * 60)

        const PRODUCAO_BASE_POR_HORA = 300 // MVP

        const novaMadeira = village.resources.wood + (village.buildings.timberCamp * PRODUCAO_BASE_POR_HORA * horasPassadas)
        const novaArgila  = village.resources.clay  + (village.buildings.clayPit    * PRODUCAO_BASE_POR_HORA * horasPassadas)
        const novoFerro   = village.resources.iron  + (village.buildings.ironMine   * PRODUCAO_BASE_POR_HORA * horasPassadas)

        const recursosAtualizados = await prisma.villageResource.update({
            where: { villageId: id },
            data: {
                wood:       novaMadeira,
                clay:       novaArgila,
                iron:       novoFerro,
                lastUpdate: agora
            }
        })

        return { ...village, resources: recursosAtualizados, activeQueue, activeUnitQueue }

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
            await fastify.listen({ port: portaAtual })
            console.log('========================================')
            console.log('TW2 Clone — Servidor iniciado (YGP)')
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