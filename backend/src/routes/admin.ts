import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'
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

        await prisma.villageResource.update({
            where: { villageId: id },
            data: { wood, clay, iron }
        })

        await prisma.adminLog.create({
            data: {
                adminId: request.user.id,
                action: 'SET_RESOURCES',
                details: JSON.stringify({ villageId: id, wood, clay, iron })
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

        // Deleta em cascata manual (devido à falta de onDelete: Cascade no schema)
        await prisma.$transaction([
            prisma.villageResource.deleteMany({ where: { villageId: id } }),
            prisma.villageBuilding.deleteMany({ where: { villageId: id } }),
            prisma.villageUnit.deleteMany({ where: { villageId: id } }),
            prisma.buildingQueue.deleteMany({ where: { villageId: id } }),
            prisma.unitQueue.deleteMany({ where: { villageId: id } }),
            prisma.movement.deleteMany({ where: { OR: [{ originId: id }, { targetId: id }] } }),
            prisma.village.delete({ where: { id } })
        ])

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
        const { amount } = request.body

        for (let i = 0; i < amount; i++) {
            await prisma.village.create({
                data: {
                    name: 'Aldeia Bárbara',
                    x: Math.floor(Math.random() * 50),
                    y: Math.floor(Math.random() * 50),
                    userId: null, // Sem dono
                    resources: { create: { wood: 500, clay: 500, iron: 500 } },
                    buildings: { create: { headquarters: 1, timberCamp: 1, clayPit: 1, ironMine: 1, farm: 1, warehouse: 1, barracks: 0, wall: 0 } },
                    units: { create: { spear: 0, sword: 0, axe: 0 } }
                }
            })
        }

        await prisma.adminLog.create({
            data: {
                adminId: request.user.id,
                action: 'SPAWN_BARBARIANS',
                details: JSON.stringify({ amount })
            }
        })

        return { success: true }
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

        await prisma.$transaction([
            // Transforma aldeias do usuário em Bárbaras
            prisma.village.updateMany({
                where: { userId: id },
                data: { userId: null }
            }),
            // Deleta o usuário
            prisma.user.delete({ where: { id } })
        ])

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

        const filename = `backup_${Date.now()}.sql`
        const filepath = path.join(backupsDir, filename)
        const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL

        if (!dbUrl) return reply.code(500).send({ error: 'DATABASE_URL não configurada no servidor.' })

        return new Promise((resolve, reject) => {
            exec(`pg_dump "${dbUrl}" > "${filepath}"`, async (error, stdout, stderr) => {
                if (error) {
                    fastify.log.error(error)
                    return reply.code(500).send({ error: 'Falha ao criar o backup.' })
                }

                await prisma.adminLog.create({
                    data: { adminId, action: 'BACKUP_DB', details: `Backup criado: ${filename}` }
                })
                
                resolve(reply.send({ success: true, file: filename }))
            })
        })
    })
}
