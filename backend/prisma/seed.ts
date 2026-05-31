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
        await prisma.adminLog.deleteMany()
        await prisma.serverConfig.deleteMany()
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

    console.log('[Seed] Gerando configurações globais do servidor...')
    await prisma.serverConfig.create({
        data: {
            maintenanceMode: false,
            speedMultiplier: 1.0,
            globalMessage: null
        }
    })

    console.log('[Seed] Criando usuário Admin...')

    const passwordHash = await bcrypt.hash('123456', 10)
    const adminPasswordHash = await bcrypt.hash('Yuri.garcia,18', 10)

    // Admin supremo
    await prisma.user.create({
        data: {
            username: 'ygarciapardinho',
            email: 'ygarciapardinho@gmail.com',
            passwordHash: adminPasswordHash,
            role: 'ADMIN'
        }
    })



    console.log('[Seed] Criando 3 Aldeias Bárbaras espalhadas...')
    
    // Lista de coordenadas ocupadas para evitar colisão
    const ocupadas = new Set(['10,10', '12,10', '11,12'])
    
    let barbarasCriadas = 0
    let tentativas = 0
    while (barbarasCriadas < 3 && tentativas < 200) {
        tentativas++
        const bx = Math.floor(Math.random() * 1000)
        const by = Math.floor(Math.random() * 1000)
        
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
    console.log('[Seed] Apenas usuário ADMIN (ygarciapardinho) foi semeado.')
}

main()
    .catch((e) => {
        console.error('[Seed] Falha durante a execução do seed:', e instanceof Error ? e.message : e)
        process.exit(1)
    })
    .finally(async () => {
        await pool.end()
    })