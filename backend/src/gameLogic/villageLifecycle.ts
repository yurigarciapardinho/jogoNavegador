import { getUnitStats } from './unitEconomy'

/**
 * Executa a deleção completa de uma aldeia com Retorno Tático para tropas em andamento.
 */
export const deleteVillageSafely = async (tx: any, villageId: string, now: Date) => {
    // 1. Apoios estacionados NESTA aldeia (mas que pertencem a outras)
    const stationedSupports = await tx.supportingTroop.findMany({
        where: { targetId: villageId }
    })

    for (const sup of stationedSupports) {
        // Retorno Tático: Como a aldeia atual deixará de existir, não podemos usar o ID dela.
        // Criamos um retorno apontando origin e target para a aldeia dona (ownerId)
        await tx.movement.create({
            data: {
                type: 'RETURN',
                originId: sup.ownerId,
                targetId: sup.ownerId,
                spear: sup.spear,
                sword: sup.sword,
                axe: sup.axe,
                wood: 0, clay: 0, iron: 0,
                startTime: now,
                arrivalTime: now, // Chegada imediata (ou poderíamos calcular distância se tivéssemos as coordenadas fáceis aqui)
            }
        })
    }
    // Deleta os apoios estacionados
    await tx.supportingTroop.deleteMany({ where: { targetId: villageId } })

    // 2. Movimentos a caminho DESTA aldeia (Ataques ou Apoios de terceiros)
    const incomingMovements = await tx.movement.findMany({
        where: { targetId: villageId, completed: false }
    })

    for (const mov of incomingMovements) {
        if (mov.originId === villageId) continue // Se era de mim pra mim, ignora

        const timeTraveled = now.getTime() - mov.startTime.getTime()
        const newArrivalTime = new Date(now.getTime() + Math.max(0, timeTraveled))

        // Converte para retorno tático usando a origem original em ambas as pontas
        await tx.movement.update({
            where: { id: mov.id },
            data: {
                type: 'RETURN',
                originId: mov.originId,
                targetId: mov.originId,
                startTime: now,
                arrivalTime: newArrivalTime
            }
        })
    }

    // 3. Movimentos de saída DESTA aldeia e Movimentos internos
    // Todos os movimentos que ainda tenham essa aldeia como origem ou destino devem ser apagados.
    // Isso inclui tropas dessa aldeia que estavam atacando fora (elas não têm para onde voltar)
    await tx.movement.deleteMany({
        where: { OR: [{ originId: villageId }, { targetId: villageId }] }
    })

    // 4. Apoios originados DESTA aldeia que estão em outras aldeias
    await tx.supportingTroop.deleteMany({
        where: { ownerId: villageId }
    })

    // 5. Tabelas Anexas da Aldeia
    await tx.villageResource.deleteMany({ where: { villageId } })
    await tx.villageBuilding.deleteMany({ where: { villageId } })
    await tx.villageUnit.deleteMany({ where: { villageId } })
    await tx.buildingQueue.deleteMany({ where: { villageId } })
    await tx.unitQueue.deleteMany({ where: { villageId } })
    await tx.villageBooster.deleteMany({ where: { villageId } })

    // 6. Finalmente, a aldeia em si
    await tx.village.delete({ where: { id: villageId } })
}

/**
 * Transfere o domínio de uma aldeia (Noblagem ou Banimento/Bárbaras).
 */
export const transferVillageOwnership = async (tx: any, villageId: string, newUserId: string | null) => {
    // Atualiza o dono
    await tx.village.update({
        where: { id: villageId },
        data: { userId: newUserId }
    })

    // 1. Zera tropas nativas dentro da aldeia (As tropas leais ao antigo dono fogem/são destruídas)
    await tx.villageUnit.update({
        where: { villageId },
        data: { spear: 0, sword: 0, axe: 0 }
    })

    // 2. Tropas nativas DESTA aldeia que estavam fora atacando ou apoiando evaporam
    await tx.movement.deleteMany({
        where: { originId: villageId, type: { in: ['ATTACK', 'SUPPORT'] } }
    })
    
    // Se havia tropas dessa aldeia retornando de saques, elas evaporam também? 
    // Em TW, tropas de aldeia conquistada somem, mesmo retornando.
    await tx.movement.deleteMany({
        where: { targetId: villageId, type: 'RETURN' }
    })

    await tx.supportingTroop.deleteMany({
        where: { ownerId: villageId }
    })

    // 3. Apoios DE TERCEIROS estacionados NESTA aldeia (Ejetar)
    const stationedSupports = await tx.supportingTroop.findMany({
        where: { targetId: villageId }
    })

    const now = new Date()
    for (const sup of stationedSupports) {
        // Manda de volta para casa
        await tx.movement.create({
            data: {
                type: 'RETURN',
                originId: villageId,
                targetId: sup.ownerId,
                spear: sup.spear,
                sword: sup.sword,
                axe: sup.axe,
                wood: 0, clay: 0, iron: 0,
                startTime: now,
                arrivalTime: now // Retorno instantâneo para não recalcularmos distância
            }
        })
    }
    await tx.supportingTroop.deleteMany({ where: { targetId: villageId } })

    // As tropas de terceiros que estavam A CAMINHO desta aldeia continuarão a marcha (Conversão Assistida)
    // Então não mexemos nelas. O combatLoop resolverá bater no novo dono.
}
