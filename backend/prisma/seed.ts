import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'
import dns from 'node:dns'

dns.setDefaultResultOrder('ipv4first')

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL

if (!connectionString) {
    console.error('[ERRO FATAL] Nenhuma variável DATABASE_URL ou DIRECT_URL encontrada no arquivo .env')
    process.exit(1)
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function comRetry<T>(fn: () => Promise<T>, tentativas = 5, intervaloMs = 1000): Promise<T> {
    let ultimoErro: unknown
    for (let i = 0; i < tentativas; i++) {
        try {
            return await fn()
        } catch (err) {
            ultimoErro = err
            const codigo = (err as Record<string, string>)?.code ?? (err as Record<string, string>)?.name ?? ''
            console.warn(`[Tentativa ${i + 1}/${tentativas}] Falha na operação: ${codigo || (err instanceof Error ? err.message : String(err))}`)
            if (i + 1 < tentativas) {
                console.warn(`Aguardando ${intervaloMs}ms antes de tentar novamente...`)
                await new Promise((r) => setTimeout(r, intervaloMs))
                intervaloMs *= 2
            }
        }
    }
    throw ultimoErro
}

async function main() {
    console.log('[Seed] Limpando o banco de dados...')

    await comRetry(async () => {
        await prisma.combatReport.deleteMany()
        await prisma.movement.deleteMany()
        await prisma.buildingQueue.deleteMany()
        await prisma.unitQueue.deleteMany()
        await prisma.villageResource.deleteMany()
        await prisma.villageBuilding.deleteMany()
        await prisma.villageUnit.deleteMany()
        await prisma.village.deleteMany()
        await prisma.user.deleteMany()
    })

    console.log('[Seed] Criando usuários ProGamer, PlayerNormal e Noob...')

    const passwordHash = await bcrypt.hash('123456', 10)

    // 1. ProGamer: Aldeia mega evoluída, muitos recursos e exército de cavalaria leve (representada por machados no MVP)
    const progamer = await prisma.user.create({
        data: {
            username: 'ProGamer',
            email: 'progamer@tw2.com',
            passwordHash,
            villages: {
                create: {
                    name: 'Capital do Império',
                    x: 10,
                    y: 10,
                    resources: {
                        create: { wood: 35000, clay: 35000, iron: 35000 }
                    },
                    buildings: {
                        create: { headquarters: 25, timberCamp: 25, clayPit: 25, ironMine: 25, farm: 30, warehouse: 30, barracks: 20, wall: 20 }
                    },
                    units: {
                        create: { spear: 0, sword: 0, axe: 3000 }
                    }
                }
            }
        }
    })

    // 2. PlayerNormal: Aldeia equilibrada, focada em defesa e produção média
    const playerNormal = await prisma.user.create({
        data: {
            username: 'PlayerNormal',
            email: 'normal@tw2.com',
            passwordHash,
            villages: {
                create: {
                    name: 'Aldeia Segura',
                    x: 12,
                    y: 10,
                    resources: {
                        create: { wood: 8000, clay: 8000, iron: 8000 }
                    },
                    buildings: {
                        create: { headquarters: 15, timberCamp: 18, clayPit: 18, ironMine: 18, farm: 15, warehouse: 15, barracks: 10, wall: 10 }
                    },
                    units: {
                        create: { spear: 1000, sword: 1000, axe: 100 }
                    }
                }
            }
        }
    })

    // 3. Noob: Iniciante, quase sem nada
    const noob = await prisma.user.create({
        data: {
            username: 'Noob',
            email: 'noob@tw2.com',
            passwordHash,
            villages: {
                create: {
                    name: 'Primeira Aldeia',
                    x: 11,
                    y: 12,
                    resources: {
                        create: { wood: 500, clay: 500, iron: 500 }
                    },
                    buildings: {
                        create: { headquarters: 1, timberCamp: 0, clayPit: 0, ironMine: 0, farm: 1, warehouse: 1, barracks: 0, wall: 0 }
                    },
                    units: {
                        create: { spear: 0, sword: 0, axe: 0 }
                    }
                }
            }
        }
    })

    console.log('[Seed] Criando 20 Aldeias Bárbaras espalhadas...')
    
    // Lista de coordenadas ocupadas para evitar colisão
    const ocupadas = new Set(['10,10', '12,10', '11,12'])
    
    let barbarasCriadas = 0
    let tentativas = 0
    while (barbarasCriadas < 20 && tentativas < 200) {
        tentativas++
        const bx = Math.floor(Math.random() * 20)
        const by = Math.floor(Math.random() * 20)
        
        if (ocupadas.has(`${bx},${by}`)) continue
        
        ocupadas.add(`${bx},${by}`)
        
        // Variação de aldeias bárbaras (umas ricas, outras pobres)
        const nivel = Math.floor(Math.random() * 15) + 1
        const rec = Math.floor(Math.random() * 3000) + 200
        
        await prisma.village.create({
            data: {
                name: `Aldeia Bárbara`,
                x: bx,
                y: by,
                userId: null,
                resources: { create: { wood: rec, clay: rec, iron: rec } },
                buildings: { create: { timberCamp: nivel, clayPit: nivel, ironMine: nivel, barracks: 0, wall: 0, headquarters: 1, farm: 1, warehouse: 1 } },
                units: { create: { spear: 0, sword: 0, axe: 0 } }
            }
        })
        barbarasCriadas++
    }

    console.log(`[Seed] Concluído com sucesso! Foram geradas ${barbarasCriadas} aldeias bárbaras.`)
    console.log('[Seed] Login ProGamer     (Veterano): ProGamer / 123456')
    console.log('[Seed] Login PlayerNormal (Médio): PlayerNormal / 123456')
    console.log('[Seed] Login Noob         (Iniciante): Noob / 123456')
}

main()
    .catch((e) => {
        console.error('[Seed] Falha durante a execução do seed:', e instanceof Error ? e.message : e)
        process.exit(1)
    })
    .finally(async () => {
        await pool.end()
    })