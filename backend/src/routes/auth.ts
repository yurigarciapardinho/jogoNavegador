import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

// Tipagem do body para evitar any
interface RegisterBody {
    email?: string
    username?: string
    password?: string
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
            // Busca coordenadas ocupadas no mapa para sortear uma livre
            const vilasOcupadas = await prisma.village.findMany({ select: { x: true, y: true } })
            const ocupadasSet = new Set(vilasOcupadas.map(v => `${v.x},${v.y}`))
            
            let x = 0, y = 0
            let achouLivre = false
            for (let tentativa = 0; tentativa < 100; tentativa++) {
                x = Math.floor(Math.random() * 20)
                y = Math.floor(Math.random() * 20)
                if (!ocupadasSet.has(`${x},${y}`)) {
                    achouLivre = true
                    break
                }
            }

            if (!achouLivre) {
                return reply.code(507).send({ error: 'Servidor lotado. Não há espaço no mapa.' })
            }

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
                        units: { create: {} } // defaults
                    }
                })

                return user
            })

            // Spawn dinâmico de aldeias bárbaras nas proximidades (Assíncrono, fora da transação do usuário)
            // Fire-and-forget para não falhar o cadastro se der erro de unique constraint
            setTimeout(async () => {
                try {
                    for (let i = 0; i < 2; i++) {
                        const bx = Math.max(0, Math.min(19, x + Math.floor(Math.random() * 5) - 2))
                        const by = Math.max(0, Math.min(19, y + Math.floor(Math.random() * 5) - 2))
                        
                        // Checa pra ver se tá livre no nanosegundo atual
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
                        }
                    }
                } catch (err) {
                    // Ignora falhas menores no spawn de bárbaros
                }
            }, 50)

            const token = fastify.jwt.sign({ id: newUser.id, username: newUser.username })
            return { token, message: 'Conta criada com sucesso.' }

        } catch (error) {
            fastify.log.error({ error }, 'Erro ao criar usuário')
            return reply.code(500).send({ error: 'Erro ao criar conta. Tente novamente mais tarde.' })
        }
    })

    fastify.post('/auth/login', async (request, reply) => {
        const body = request.body as LoginBody

        if (!body?.username || !body?.password) {
            return reply.code(400).send({ error: 'Usuário e senha são obrigatórios.' })
        }

        const username = body.username.trim()
        const password = body.password

        const user = await prisma.user.findUnique({
            where: { username }
        })

        if (!user) {
            return reply.code(401).send({ error: 'Usuário não encontrado.' })
        }

        const senhaValida = await bcrypt.compare(password, user.passwordHash)

        if (!senhaValida) {
            return reply.code(401).send({ error: 'Senha incorreta.' })
        }

        const token = fastify.jwt.sign({ id: user.id, username: user.username })
        return { token }
    })
}
