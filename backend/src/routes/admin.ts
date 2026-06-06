import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'
import { invalidarServerConfigCache } from '../utils/serverConfigCache'
import { deleteVillageSafely, transferVillageOwnership } from '../gameLogic/villageLifecycle'
import { getWarehouseCapacity, MAX_LEVELS } from '../gameLogic/economy'
// Middleware inline de verificação Admin
const adminMiddleware = async (request: any, reply: any) => {
    try {
        await request.jwtVerify()
        if (request.user.role !== 'ADMIN') {
            return reply.code(403).send({ error: 'Acesso negado. Apenas administradores.' })
        }
    } catch (err) {
        return reply.code(401).send({ error: 'Não autorizado.' })
    }
}

export default async function adminRoutes(fastify: FastifyInstance, opts: { prisma: PrismaClient }) {
    const { prisma } = opts

    fastify.addHook('preHandler', adminMiddleware)

    // 1. KPIs Visão Geral
    fastify.get('/admin/kpis', async (request, reply) => {
        const totalUsers = await prisma.user.count()
        const totalVillages = await prisma.village.count()
        const totalReports = await prisma.combatReport.count()

        // Soma total de recursos do servidor (Exemplo de métrica avançada)
        const aggregations = await prisma.villageResource.aggregate({
            _sum: {
                wood: true,
                clay: true,
                iron: true
            }
        })

        return {
            totalUsers,
            totalVillages,
            totalReports,
            totalEconomy: {
                wood: aggregations._sum.wood || 0,
                clay: aggregations._sum.clay || 0,
                iron: aggregations._sum.iron || 0,
            }
        }
    })

    // 2. Obter todas as aldeias (Mesa de Guerra) com Paginação, Pesquisa e Filtros
    fastify.get('/admin/villages', async (request: any, reply) => {
        const page = parseInt(request.query.page as string) || 1
        const limit = parseInt(request.query.limit as string) || 10
        const search = request.query.search as string || ''
        const filter = request.query.filter as string || 'all'

        let whereClause: any = {}

        // Filtro de Dono (Jogadores vs Bárbaras)
        if (filter === 'players') {
            whereClause.userId = { not: null }
        } else if (filter === 'barbarians') {
            whereClause.userId = null
        }

        // Pesquisa Textual (Nome da Aldeia ou Username do Dono)
        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { user: { username: { contains: search, mode: 'insensitive' } } }
            ]
        }

        const skip = (page - 1) * limit

        const [villages, totalCount] = await Promise.all([
            prisma.village.findMany({
                where: whereClause,
                include: {
                    user: { select: { username: true } },
                    resources: true,
                    units: true,
                    buildings: true
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: skip
            }),
            prisma.village.count({ where: whereClause })
        ])

        return {
            data: villages,
            meta: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        }
    })

    // 3. Modificar Recursos de uma Aldeia
    fastify.put('/admin/village/:id/resources', async (request: any, reply) => {
        const { id } = request.params
        const { wood, clay, iron } = request.body

        // Limita os recursos à capacidade do armazém da aldeia
        const village = await prisma.village.findUnique({
            where: { id },
            include: { buildings: true }
        })

        if (!village) {
            return reply.code(404).send({ error: 'Aldeia não encontrada.' })
        }

        const maxCapacity = getWarehouseCapacity(village.buildings?.warehouse || 1)
        
        const finalWood = Math.min(wood, maxCapacity)
        const finalClay = Math.min(clay, maxCapacity)
        const finalIron = Math.min(iron, maxCapacity)

        await prisma.villageResource.update({
            where: { villageId: id },
            data: { wood: finalWood, clay: finalClay, iron: finalIron }
        })

        await prisma.adminLog.create({
            data: {
                adminId: request.user.id,
                action: 'SET_RESOURCES',
                details: JSON.stringify({ villageId: id, wood: finalWood, clay: finalClay, iron: finalIron })
            }
        })

        return { success: true }
    })

    // 3.5 Modificar Edifícios de uma Aldeia
    fastify.put('/admin/village/:id/buildings', async (request: any, reply) => {
        const { id } = request.params
        const {
            headquarters, timberCamp, clayPit, ironMine, farm, warehouse, barracks, wall, church
        } = request.body

        // Garante que não ultrapasse MAX_LEVELS e não seja menor que 0
        const finalBlds = {
            headquarters: Math.max(1, Math.min(headquarters || 1, MAX_LEVELS.headquarters || 25)),
            timberCamp: Math.max(0, Math.min(timberCamp || 0, MAX_LEVELS.timberCamp || 25)),
            clayPit: Math.max(0, Math.min(clayPit || 0, MAX_LEVELS.clayPit || 25)),
            ironMine: Math.max(0, Math.min(ironMine || 0, MAX_LEVELS.ironMine || 25)),
            farm: Math.max(1, Math.min(farm || 1, MAX_LEVELS.farm || 30)),
            warehouse: Math.max(1, Math.min(warehouse || 1, MAX_LEVELS.warehouse || 30)),
            barracks: Math.max(0, Math.min(barracks || 0, MAX_LEVELS.barracks || 25)),
            wall: Math.max(0, Math.min(wall || 0, MAX_LEVELS.wall || 20)),
            church: Math.max(0, Math.min(church || 0, MAX_LEVELS.church || 3))
        }

        await prisma.villageBuilding.update({
            where: { villageId: id },
            data: finalBlds
        })

        await prisma.adminLog.create({
            data: {
                adminId: request.user.id,
                action: 'SET_BUILDINGS',
                details: JSON.stringify({ villageId: id, ...finalBlds })
            }
        })

        return { success: true }
    })

    // 4. Modificar Tropas
    fastify.put('/admin/village/:id/troops', async (request: any, reply) => {
        const { id } = request.params
        const { spear, sword, axe } = request.body

        await prisma.villageUnit.update({
            where: { villageId: id },
            data: { spear, sword, axe }
        })

        await prisma.adminLog.create({
            data: {
                adminId: request.user.id,
                action: 'SET_TROOPS',
                details: JSON.stringify({ villageId: id, spear, sword, axe })
            }
        })

        return { success: true }
    })

    // 5. Deletar Aldeia
    fastify.delete('/admin/village/:id', async (request: any, reply) => {
        const { id } = request.params

        await prisma.$transaction(async (tx) => {
            await deleteVillageSafely(tx, id, new Date())
        })

        await prisma.adminLog.create({
            data: {
                adminId: request.user.id,
                action: 'DELETE_VILLAGE',
                details: JSON.stringify({ villageId: id })
            }
        })

        return { success: true }
    })
    
    // 6. Logs de Admin
    fastify.get('/admin/logs', async () => {
        return prisma.adminLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        })
    })

    // 7. Spawn Barbarians
    fastify.post('/admin/barbarians/spawn', async (request: any, reply) => {
        const { amount, pattern = 'small', mode = 'global', centerX = 25, centerY = 25, radius = 5 } = request.body

        // Função utilitária para gerar número aleatório em um intervalo
        const randRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

        for (let i = 0; i < amount; i++) {
            // 1. Calcular Coordenadas Baseadas no Modo
            let x = 0; let y = 0;
            if (mode === 'radius') {
                x = Math.max(0, Math.min(999, centerX + randRange(-radius, radius)))
                y = Math.max(0, Math.min(999, centerY + randRange(-radius, radius)))
            } else {
                x = randRange(0, 999)
                y = randRange(0, 999)
            }

            // 2. Determinar Níveis Baseados no Pattern
            let bld = { hq: 1, tc: 1, cp: 1, im: 1, farm: 1, wh: 1, br: 0, wall: 0 }
            let res = { w: 500, c: 500, i: 500 }
            
            if (pattern === 'medium') {
                bld = { hq: randRange(5, 10), tc: randRange(5, 12), cp: randRange(5, 12), im: randRange(5, 12), farm: randRange(5, 10), wh: randRange(5, 10), br: randRange(1, 5), wall: randRange(1, 5) }
                res = { w: 2500, c: 2500, i: 2500 }
            } else if (pattern === 'large') {
                bld = { hq: randRange(15, 20), tc: randRange(15, 20), cp: randRange(15, 20), im: randRange(15, 20), farm: randRange(15, 20), wh: randRange(15, 20), br: randRange(10, 15), wall: randRange(10, 15) }
                res = { w: 15000, c: 15000, i: 15000 }
            }

            await prisma.village.create({
                data: {
                    name: 'Aldeia Bárbara',
                    x,
                    y,
                    userId: null, // Sem dono
                    resources: { create: { wood: res.w, clay: res.c, iron: res.i } },
                    buildings: { create: { headquarters: bld.hq, timberCamp: bld.tc, clayPit: bld.cp, ironMine: bld.im, farm: bld.farm, warehouse: bld.wh, barracks: bld.br, wall: bld.wall } },
                    units: { create: { spear: 0, sword: 0, axe: 0 } }
                }
            })
        }

        await prisma.adminLog.create({
            data: {
                adminId: request.user.id,
                action: 'SPAWN_BARBARIANS',
                details: JSON.stringify({ amount, pattern, mode, centerX, centerY, radius })
            }
        })

        return { success: true }
    })

    // 7.5 Limpar Bárbaras
    fastify.delete('/admin/barbarians/clear', async (request: any, reply) => {
        // Para simplificar a foreign_key, vamos deletar as relações primeiro ou usar onDelete Cascade
        // Como o banco está configurado (depende do Prisma schema, mas deleteVillageSafely já lida com isso)
        
        const barbarians = await prisma.village.findMany({ where: { userId: null } })
        let deletedCount = 0

        await prisma.$transaction(async (tx) => {
            for (const b of barbarians) {
                await deleteVillageSafely(tx, b.id, new Date())
                deletedCount++
            }
        })

        await prisma.adminLog.create({
            data: {
                adminId: request.user.id,
                action: 'CLEAR_BARBARIANS',
                details: JSON.stringify({ deletedCount })
            }
        })

        return { success: true, deletedCount }
    })

    // 8. Apagar Histórico de Logs
    fastify.delete('/admin/logs/clear', async (request: any, reply) => {
        await prisma.adminLog.deleteMany({})
        // Único log que sobrevive: o de quem apagou
        await prisma.adminLog.create({
            data: {
                adminId: request.user.id,
                action: 'CLEAR_LOGS',
                details: 'Limpou todo o histórico de auditoria.'
            }
        })
        return { success: true }
    })

    // 8.1 Buscar Usuários Simples (Autocomplete)
    fastify.get('/admin/users/search', async (request: any, reply) => {
        const query = request.query.q as string || ''
        if (query.length < 2) return []

        const users = await prisma.user.findMany({
            where: {
                username: { contains: query, mode: 'insensitive' }
            },
            select: { id: true, username: true },
            take: 10
        })
        return users
    })

    // 8.2 Mover Aldeia (Drag & Drop)
    fastify.put('/admin/village/:id/move', async (request: any, reply) => {
        const { id } = request.params
        let { x, y } = request.body

        // Limites matemáticos
        x = Math.max(0, Math.min(999, parseInt(x) || 0))
        y = Math.max(0, Math.min(999, parseInt(y) || 0))

        try {
            await prisma.village.update({
                where: { id },
                data: { x, y }
            })
            
            await prisma.adminLog.create({
                data: {
                    adminId: request.user.id,
                    action: 'MOVE_VILLAGE',
                    details: JSON.stringify({ villageId: id, x, y })
                }
            })
            return { success: true }
        } catch (error: any) {
            // Prisma error P2002: Unique constraint failed
            if (error.code === 'P2002') {
                return reply.code(409).send({ error: 'Coordenada já ocupada por outra aldeia.' })
            }
            return reply.code(500).send({ error: 'Erro ao mover aldeia.' })
        }
    })

    // 8.3 Criar Aldeia Única no Mapa
    fastify.post('/admin/village/spawn-single', async (request: any, reply) => {
        let { x, y, type = 'barbarian', ownerUsername, pattern = 'medium' } = request.body

        x = Math.max(0, Math.min(999, parseInt(x) || 0))
        y = Math.max(0, Math.min(999, parseInt(y) || 0))

        let userId: string | null = null
        let villageName = 'Aldeia Bárbara'

        if (type === 'player' && ownerUsername) {
            const user = await prisma.user.findUnique({ where: { username: ownerUsername } })
            if (!user) {
                return reply.code(404).send({ error: 'Jogador não encontrado.' })
            }
            userId = user.id
            
            const villageCount = await prisma.village.count({ where: { userId: user.id } })
            
            const ordinals = ["Primeira", "Segunda", "Terceira", "Quarta", "Quinta", "Sexta", "Sétima", "Oitava", "Nona", "Décima"]
            if (villageCount === 0) {
                villageName = `Aldeia de ${user.username}`
            } else if (villageCount < 10) {
                villageName = `${ordinals[villageCount]} Aldeia de ${user.username}`
            } else {
                villageName = `${villageCount + 1}ª Aldeia de ${user.username}`
            }
        }

        const randRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

        let bld = { hq: 1, tc: 1, cp: 1, im: 1, farm: 1, wh: 1, br: 0, wall: 0 }
        let res = { w: 500, c: 500, i: 500 }
        
        if (pattern === 'medium') {
            bld = { hq: randRange(5, 10), tc: randRange(5, 12), cp: randRange(5, 12), im: randRange(5, 12), farm: randRange(5, 10), wh: randRange(5, 10), br: randRange(1, 5), wall: randRange(1, 5) }
            res = { w: 2500, c: 2500, i: 2500 }
        } else if (pattern === 'large') {
            bld = { hq: randRange(15, 20), tc: randRange(15, 20), cp: randRange(15, 20), im: randRange(15, 20), farm: randRange(15, 20), wh: randRange(15, 20), br: randRange(10, 15), wall: randRange(10, 15) }
            res = { w: 15000, c: 15000, i: 15000 }
        }

        try {
            const village = await prisma.village.create({
                data: {
                    name: villageName,
                    x,
                    y,
                    userId,
                    resources: { create: { wood: res.w, clay: res.c, iron: res.i } },
                    buildings: { create: { headquarters: bld.hq, timberCamp: bld.tc, clayPit: bld.cp, ironMine: bld.im, farm: bld.farm, warehouse: bld.wh, barracks: bld.br, wall: bld.wall } },
                    units: { create: { spear: 0, sword: 0, axe: 0 } }
                }
            })

            await prisma.adminLog.create({
                data: {
                    adminId: request.user.id,
                    action: 'SPAWN_SINGLE',
                    details: JSON.stringify({ x, y, type, ownerUsername, pattern })
                }
            })

            return { success: true, village }
        } catch (error: any) {
            if (error.code === 'P2002') {
                return reply.code(409).send({ error: 'Coordenada já ocupada por outra aldeia.' })
            }
            return reply.code(500).send({ error: 'Erro ao criar aldeia.' })
        }
    })

    // 9. Gestão de Contas (Listar)
    fastify.get('/admin/users', async (request: any, reply) => {
        const page = parseInt(request.query.page as string) || 1
        const limit = parseInt(request.query.limit as string) || 10
        const search = request.query.search as string || ''

        let whereClause: any = {}
        if (search) {
            whereClause.OR = [
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ]
        }

        const skip = (page - 1) * limit
        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({
                where: whereClause,
                select: { id: true, username: true, email: true, role: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: skip
            }),
            prisma.user.count({ where: whereClause })
        ])

        return { data: users, meta: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) } }
    })

    // 10. Mudar Cargo do Usuário
    fastify.put('/admin/users/:id/role', async (request: any, reply) => {
        const { id } = request.params
        const { role } = request.body

        if (id === request.user.id) {
            return reply.code(400).send({ error: 'Você não pode rebaixar a si mesmo.' })
        }

        await prisma.user.update({
            where: { id },
            data: { role }
        })

        await prisma.adminLog.create({
            data: { adminId: request.user.id, action: 'CHANGE_ROLE', details: `Alterou o cargo do usuário ${id} para ${role}` }
        })
        return { success: true }
    })

    // 11. Banir/Deletar Usuário (As aldeias viram bárbaras)
    fastify.delete('/admin/users/:id', async (request: any, reply) => {
        const { id } = request.params
        if (id === request.user.id) return reply.code(400).send({ error: 'Não pode apagar a si mesmo.' })

        await prisma.$transaction(async (tx) => {
            const userVillages = await tx.village.findMany({ where: { userId: id } })
            for (const v of userVillages) {
                await transferVillageOwnership(tx, v.id, null)
            }
            await tx.userQuest.deleteMany({ where: { userId: id } })
            await tx.user.delete({ where: { id } })
        })

        await prisma.adminLog.create({
            data: { adminId: request.user.id, action: 'DELETE_USER', details: `Deletou o usuário ${id}. As aldeias viraram bárbaras.` }
        })
        return { success: true }
    })

    // 12. WIPE DB (Preserva apenas a conta do Admin logado)
    fastify.post('/admin/db/wipe', async (request: any, reply) => {
        const adminId = request.user.id
        const { password } = request.body

        if (!password) return reply.code(400).send({ error: 'Senha obrigatória.' })

        const admin = await prisma.user.findUnique({ where: { id: adminId } })
        if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
            return reply.code(401).send({ error: 'Senha incorreta. Ação abortada.' })
        }

        await prisma.$transaction([
            prisma.userQuest.deleteMany({}),
            prisma.villageBooster.deleteMany({}),
            prisma.supportingTroop.deleteMany({}),
            prisma.combatReport.deleteMany({}),
            prisma.movement.deleteMany({}),
            prisma.unitQueue.deleteMany({}),
            prisma.buildingQueue.deleteMany({}),
            prisma.villageUnit.deleteMany({}),
            prisma.villageBuilding.deleteMany({}),
            prisma.villageResource.deleteMany({}),
            prisma.village.deleteMany({}),
            prisma.adminLog.deleteMany({}),
            prisma.user.deleteMany({
                where: { id: { not: adminId } } // Preserva o admin
            })
        ])

        await prisma.adminLog.create({
            data: { adminId, action: 'WIPE_DATABASE', details: 'EXECUTOU O WIPE GLOBAL DO SERVIDOR.' }
        })

        return { success: true }
    })

    // 13. Buscar Configurações Atuais
    fastify.get('/admin/config', async (request: any, reply) => {
        let config = await prisma.serverConfig.findFirst()
        if (!config) {
            config = await prisma.serverConfig.create({ data: { maintenanceMode: false, speedMultiplier: 1.0, globalMessage: null } })
        }
        return config
    })

    // 14. Atualizar Configurações Globais
    fastify.put('/admin/config', async (request: any, reply) => {
        const { maintenanceMode, speedMultiplier, globalMessage } = request.body
        const adminId = request.user.id

        const config = await prisma.serverConfig.findFirst()
        if (!config) return reply.code(500).send({ error: 'Configuração não encontrada.' })

        await prisma.serverConfig.update({
            where: { id: config.id },
            data: { maintenanceMode, speedMultiplier, globalMessage }
        })

        invalidarServerConfigCache()

        await prisma.adminLog.create({
            data: { adminId, action: 'UPDATE_CONFIG', details: `Manutenção: ${maintenanceMode}, Velocidade: ${speedMultiplier}, Mensagem: ${globalMessage || 'Nenhuma'}` }
        })

        return { success: true }
    })

    // 15. Realizar Backup (pg_dump)
    fastify.post('/admin/db/backup', async (request: any, reply) => {
        const adminId = request.user.id
        const { password } = request.body

        if (!password) return reply.code(400).send({ error: 'Senha obrigatória.' })

        const admin = await prisma.user.findUnique({ where: { id: adminId } })
        if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
            return reply.code(401).send({ error: 'Senha incorreta. Ação abortada.' })
        }

        const backupsDir = path.join(process.cwd(), 'backups')
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir)
        }

        const filename = `backup_${Date.now()}.json`
        const filepath = path.join(backupsDir, filename)

        try {
            const dbDump = {
                users: await prisma.user.findMany(),
                serverConfig: await prisma.serverConfig.findMany(),
                villages: await prisma.village.findMany({
                    include: {
                        resources: true,
                        buildings: true,
                        units: true,
                        boosters: true
                    }
                }),
                movements: await prisma.movement.findMany(),
                combatReports: await prisma.combatReport.findMany(),
                buildingQueues: await prisma.buildingQueue.findMany(),
                unitQueues: await prisma.unitQueue.findMany(),
                adminLogs: await prisma.adminLog.findMany(),
                userQuests: await prisma.userQuest.findMany()
            }

            fs.writeFileSync(filepath, JSON.stringify(dbDump, null, 2))

            await prisma.adminLog.create({
                data: { adminId, action: 'BACKUP_DB', details: `Backup JSON criado: ${filename}` }
            })
            
            return { success: true, file: filename }
        } catch (error) {
            fastify.log.error(error)
            return reply.code(500).send({ error: 'Falha ao criar o backup JSON.' })
        }
    })

    // 16. Listar Backups (JSON)
    fastify.get('/admin/db/backups', async (request: any, reply) => {
        const backupsDir = path.join(process.cwd(), 'backups')
        if (!fs.existsSync(backupsDir)) return { backups: [] }
        const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.json'))
        files.sort((a, b) => {
            return fs.statSync(path.join(backupsDir, b)).mtimeMs - fs.statSync(path.join(backupsDir, a)).mtimeMs
        })
        return { backups: files }
    })

    // 17. Restaurar Backup
    fastify.post('/admin/db/restore', async (request: any, reply) => {
        const adminId = request.user.id
        const { password, filename } = request.body

        if (!password || !filename) return reply.code(400).send({ error: 'Senha e Nome do Arquivo são obrigatórios.' })

        const admin = await prisma.user.findUnique({ where: { id: adminId } })
        if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
            return reply.code(401).send({ error: 'Senha incorreta. Restauração abortada.' })
        }

        const filepath = path.join(process.cwd(), 'backups', filename)
        if (!fs.existsSync(filepath)) {
            return reply.code(404).send({ error: 'Arquivo de backup não encontrado.' })
        }

        try {
            const rawData = fs.readFileSync(filepath, 'utf-8')
            const dbDump = JSON.parse(rawData)

            await prisma.$transaction([
                prisma.userQuest.deleteMany({}),
                prisma.villageBooster.deleteMany({}),
                prisma.supportingTroop.deleteMany({}),
                prisma.combatReport.deleteMany({}),
                prisma.movement.deleteMany({}),
                prisma.unitQueue.deleteMany({}),
                prisma.buildingQueue.deleteMany({}),
                prisma.villageUnit.deleteMany({}),
                prisma.villageBuilding.deleteMany({}),
                prisma.villageResource.deleteMany({}),
                prisma.village.deleteMany({}),
                prisma.user.deleteMany({}),
                prisma.serverConfig.deleteMany({})
            ])

            if (dbDump.users?.length) await prisma.user.createMany({ data: dbDump.users })
            if (dbDump.serverConfig?.length) await prisma.serverConfig.createMany({ data: dbDump.serverConfig })

            if (dbDump.villages?.length) {
                const villagesBase = dbDump.villages.map((v: any) => ({
                    id: v.id, name: v.name, x: v.x, y: v.y, userId: v.userId, createdAt: v.createdAt
                }))
                await prisma.village.createMany({ data: villagesBase })

                const resources = []
                const buildings = []
                const units = []
                const boosters = []

                for (const v of dbDump.villages) {
                    if (v.resources) {
                        const { villageId, ...rest } = v.resources
                        resources.push({ ...rest, villageId: v.id })
                    }
                    if (v.buildings) {
                        const { villageId, ...rest } = v.buildings
                        buildings.push({ ...rest, villageId: v.id })
                    }
                    if (v.units) {
                        const { villageId, ...rest } = v.units
                        units.push({ ...rest, villageId: v.id })
                    }
                    if (v.boosters?.length) {
                        v.boosters.forEach((b: any) => {
                            const { villageId, ...rest } = b
                            boosters.push({ ...rest, villageId: v.id })
                        })
                    }
                }

                if (resources.length) await prisma.villageResource.createMany({ data: resources })
                if (buildings.length) await prisma.villageBuilding.createMany({ data: buildings })
                if (units.length) await prisma.villageUnit.createMany({ data: units })
                if (boosters.length) await prisma.villageBooster.createMany({ data: boosters })
            }

            if (dbDump.movements?.length) await prisma.movement.createMany({ data: dbDump.movements })
            if (dbDump.combatReports?.length) await prisma.combatReport.createMany({ data: dbDump.combatReports })
            if (dbDump.buildingQueues?.length) await prisma.buildingQueue.createMany({ data: dbDump.buildingQueues })
            if (dbDump.unitQueues?.length) await prisma.unitQueue.createMany({ data: dbDump.unitQueues })
            if (dbDump.userQuests?.length) await prisma.userQuest.createMany({ data: dbDump.userQuests })
            
            await prisma.adminLog.create({
                data: { adminId, action: 'RESTORE_DB', details: `O Backup ${filename} foi restaurado. O mundo anterior foi apagado.` }
            })

            invalidarServerConfigCache()

            return { success: true, message: 'Backup restaurado com sucesso!' }
        } catch (error) {
            fastify.log.error(error)
            return reply.code(500).send({ error: 'Erro catastrófico ao restaurar o JSON.' })
        }
    })
}
