import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'
import { gerarCoordenadaSpawn } from '../utils/spawn'

// Tipagem do body para evitar any
interface RegisterBody {
    email?: string
    username?: string
    password?: string
    region?: string
}

interface LoginBody {
    username?: string
    password?: string
}

export default async function authRoutes(fastify: FastifyInstance, opts: { prisma: PrismaClient }) {
    const { prisma } = opts

    fastify.post('/auth/register', async (request, reply) => {
        const body = request.body as RegisterBody

        if (!body?.email || !body?.username || !body?.password) {
            return reply.code(400).send({ error: 'E-mail, usuário e senha são obrigatórios.' })
        }

        const email = body.email.trim().toLowerCase()
        const username = body.username.trim()
        const password = body.password

        if (password.length < 6) {
            return reply.code(400).send({ error: 'A senha deve ter pelo menos 6 caracteres.' })
        }

        // Verifica se usuário existe
        const usuarioExistente = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { username }
                ]
            }
        })

        if (usuarioExistente) {
            return reply.code(400).send({ error: 'E-mail ou usuário já está em uso.' })
        }

        const passwordHash = await bcrypt.hash(password, 10)

        try {
            const coords = await gerarCoordenadaSpawn(prisma, body.region || 'ALEATORIO')
            
            if (!coords) {
                return reply.code(507).send({ error: 'Servidor lotado. Não há espaço no mapa.' })
            }
            
            const { x, y } = coords;

            // Cria usuário e aldeia inicial em uma transação limpa
            const newUser = await prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email,
                        username,
                        passwordHash
                    }
                })

                await tx.village.create({
                    data: {
                        name: `Aldeia de ${username}`,
                        x,
                        y,
                        userId: user.id,
                        resources: { create: { wood: 500, clay: 500, iron: 500 } },
                        buildings: { create: {} }, // defaults
                        units: { create: {} }, // defaults
                        boosters: {
                            create: {
                                boosterType: 'ALL_RESOURCES',
                                multiplier: 2.0,
                                endTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas de booster
                            }
                        }
                    }
                })

                return user
            })

            // Spawn dinâmico de UMA aldeia bárbara nas proximidades (Assíncrono, fora da transação do usuário)
            // Fire-and-forget para não falhar o cadastro se der erro de unique constraint
            setTimeout(async () => {
                try {
                    let created = false
                    for (let tentativa = 0; tentativa < 5 && !created; tentativa++) {
                        const bx = Math.max(0, Math.min(999, x + Math.floor(Math.random() * 5) - 2))
                        const by = Math.max(0, Math.min(999, y + Math.floor(Math.random() * 5) - 2))
                        
                        // Não pode ser a mesma coordenada do jogador
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
                } catch (err) {
                    // Ignora falhas menores no spawn de bárbaros
                }
            }, 50)

            const token = fastify.jwt.sign({ id: newUser.id, username: newUser.username, role: newUser.role })
            return { token, message: 'Conta criada com sucesso.' }

        } catch (error) {
            throw error
        }
    })

    fastify.post('/auth/login', async (request, reply) => {
        const body = request.body as LoginBody

        if (!body?.username || !body?.password) {
            return reply.code(400).send({ error: 'Usuário e senha são obrigatórios.' })
        }

        const username = body.username.trim()
        const password = body.password

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: username },
                    { email: username.toLowerCase() }
                ]
            }
        })

        if (!user) {
            return reply.code(401).send({ error: 'E-mail, usuário ou senha incorretos.' })
        }

        const senhaValida = await bcrypt.compare(password, user.passwordHash)

        if (!senhaValida) {
            return reply.code(401).send({ error: 'Senha incorreta.' })
        }

        const token = fastify.jwt.sign({ id: user.id, username: user.username, role: user.role })
        return { token }
    })
}
