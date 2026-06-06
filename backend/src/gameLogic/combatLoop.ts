import { getUnitStats } from './unitEconomy'
import { atualizarEstadoAldeia } from './villageState'
import { getWarehouseCapacity } from './economy'

const calculateCombat = (atkUnits: any, defUnits: any, wallLevel: number = 0) => {
    let atkPower = 0
    let defPower = 0

    const types = ['spear', 'sword', 'axe']
    for (const type of types) {
        const stats = getUnitStats(type)
        if (stats) {
            if (atkUnits[type]) atkPower += stats.attack * atkUnits[type]
            if (defUnits[type]) defPower += stats.defense * defUnits[type]
        }
    }

    // Bônus da Muralha: +5% poder multiplicativo e +50 flat por nível
    defPower = defPower * (1 + (wallLevel * 0.05)) + (wallLevel * 50)

    if (atkPower === 0) atkPower = 1
    if (defPower === 0) defPower = 1

    let atkLossesPct = 0
    let defLossesPct = 0

    if (atkPower > defPower) {
        defLossesPct = 1
        atkLossesPct = Math.pow(defPower / atkPower, 1.5)
    } else {
        atkLossesPct = 1
        defLossesPct = Math.pow(atkPower / defPower, 1.5)
    }

    atkLossesPct = Math.min(1, Math.max(0, atkLossesPct))
    defLossesPct = Math.min(1, Math.max(0, defLossesPct))

    return {
        survivingAtk: {
            spear: Math.round(atkUnits.spear * (1 - atkLossesPct)),
            sword: Math.round(atkUnits.sword * (1 - atkLossesPct)),
            axe: Math.round(atkUnits.axe * (1 - atkLossesPct))
        },
        survivingDef: {
            spear: Math.round(defUnits.spear * (1 - defLossesPct)),
            sword: Math.round(defUnits.sword * (1 - defLossesPct)),
            axe: Math.round(defUnits.axe * (1 - defLossesPct))
        },
        attackerWon: atkPower > defPower
    }
}

export const startCombatLoop = (prisma: any) => {
    setInterval(async () => {
        try {
            const now = new Date()
            
            const arrivedMovements = await prisma.movement.findMany({
                where: {
                    completed: false,
                    arrivalTime: { lte: now }
                },
                include: {
                    origin: { include: { resources: true } },
                    target: { include: { resources: true, buildings: true, units: true, supportingReceived: true } }
                }
            })

            for (const mov of arrivedMovements) {
                await prisma.$transaction(async (tx: any) => {
                    if (mov.type === 'ATTACK') {
                        // Sincroniza e consolida o estado do alvo até o momento exato do impacto (mov.arrivalTime)
                        const targetUpdated = await atualizarEstadoAldeia(tx, mov.targetId, mov.arrivalTime)

                        // Também recarregamos os suportes estacionados na aldeia alvo de forma fresca usando a transação
                        const supportTroops = await tx.supportingTroop.findMany({
                            where: { targetId: mov.targetId }
                        })

                        const targetUnits = targetUpdated.units || { spear: 0, sword: 0, axe: 0 }
                        
                        let defSpear = targetUnits.spear
                        let defSword = targetUnits.sword
                        let defAxe = targetUnits.axe

                        for (const sup of supportTroops) {
                            defSpear += sup.spear
                            defSword += sup.sword
                            defAxe += sup.axe
                        }

                        const atkUnits = { spear: mov.spear, sword: mov.sword, axe: mov.axe }
                        const defUnits = { spear: defSpear, sword: defSword, axe: defAxe }
                        const wallLevel = targetUpdated.buildings?.wall || 0
                        
                        const combatResult = calculateCombat(atkUnits, defUnits, wallLevel)
                        
                        const spearSurvival = defSpear > 0 ? combatResult.survivingDef.spear / defSpear : 0
                        const swordSurvival = defSword > 0 ? combatResult.survivingDef.sword / defSword : 0
                        const axeSurvival = defAxe > 0 ? combatResult.survivingDef.axe / defAxe : 0

                        if (mov.target.units) {
                            await tx.villageUnit.update({
                                where: { villageId: mov.targetId },
                                data: {
                                    spear: Math.round(targetUnits.spear * spearSurvival),
                                    sword: Math.round(targetUnits.sword * swordSurvival),
                                    axe: Math.round(targetUnits.axe * axeSurvival)
                                }
                            })
                        }

                        for (const sup of supportTroops) {
                            const newSpear = Math.round(sup.spear * spearSurvival)
                            const newSword = Math.round(sup.sword * swordSurvival)
                            const newAxe = Math.round(sup.axe * axeSurvival)
                            
                            if (newSpear + newSword + newAxe <= 0) {
                                await tx.supportingTroop.delete({ where: { id: sup.id } })
                            } else {
                                await tx.supportingTroop.update({
                                    where: { id: sup.id },
                                    data: { spear: newSpear, sword: newSword, axe: newAxe }
                                })
                            }
                        }
                        
                        let lootedWood = 0, lootedClay = 0, lootedIron = 0
                        
                        if (combatResult.attackerWon) {
                            let capacity = 0
                            const types = ['spear', 'sword', 'axe']
                            for (const type of types) {
                                const st = getUnitStats(type)
                                if (st) capacity += st.capacity * (combatResult.survivingAtk as any)[type]
                            }
                            
                            const targetRes = targetUpdated.resources
                            if (targetRes && capacity > 0) {
                                const totalRes = targetRes.wood + targetRes.clay + targetRes.iron
                                if (totalRes > 0) {
                                    const stealRatio = Math.min(1, capacity / totalRes)
                                    lootedWood = Math.floor(targetRes.wood * stealRatio)
                                    lootedClay = Math.floor(targetRes.clay * stealRatio)
                                    lootedIron = Math.floor(targetRes.iron * stealRatio)
                                    
                                    await tx.villageResource.update({
                                        where: { villageId: mov.targetId },
                                        data: {
                                            wood: targetRes.wood - lootedWood,
                                            clay: targetRes.clay - lootedClay,
                                            iron: targetRes.iron - lootedIron
                                        }
                                    })
                                }
                            }

                            if (targetUpdated.userId === null) {
                                const newAttacks = targetUpdated.attacksReceived + 1
                                if (newAttacks >= 3) {
                                    const b = targetUpdated.buildings
                                    if (b) {
                                        await tx.villageBuilding.update({
                                            where: { villageId: mov.targetId },
                                            data: {
                                                timberCamp: b.timberCamp + 1,
                                                clayPit: b.clayPit + 1,
                                                ironMine: b.ironMine + 1
                                            }
                                        })
                                    }
                                    await tx.village.update({
                                        where: { id: mov.targetId },
                                        data: { attacksReceived: 0 }
                                    })
                                } else {
                                    await tx.village.update({
                                        where: { id: mov.targetId },
                                        data: { attacksReceived: newAttacks }
                                    })
                                }
                            }

                            const duration = mov.arrivalTime.getTime() - mov.startTime.getTime()
                            const returnTime = new Date(now.getTime() + duration) 
                            
                            await tx.movement.create({
                                data: {
                                    type: 'RETURN',
                                    originId: mov.targetId,
                                    targetId: mov.originId,
                                    spear: combatResult.survivingAtk.spear,
                                    sword: combatResult.survivingAtk.sword,
                                    axe: combatResult.survivingAtk.axe,
                                    wood: lootedWood,
                                    clay: lootedClay,
                                    iron: lootedIron,
                                    arrivalTime: returnTime,
                                }
                            })
                        }

                        let reportDefSpear = defSpear
                        let reportDefSword = defSword
                        let reportDefAxe = defAxe
                        let reportDefLostSpear = defSpear - combatResult.survivingDef.spear
                        let reportDefLostSword = defSword - combatResult.survivingDef.sword
                        let reportDefLostAxe = defAxe - combatResult.survivingDef.axe

                        await tx.combatReport.create({
                            data: {
                                attackerId: mov.origin.userId || 'npc',
                                defenderId: mov.target.userId,
                                originName: mov.origin.name,
                                targetName: mov.target.name,
                                result: combatResult.attackerWon ? 'ATTACKER_WON' : 'DEFENDER_WON',
                                atkSpear: mov.spear,
                                atkSword: mov.sword,
                                atkAxe: mov.axe,
                                atkLostSpear: mov.spear - combatResult.survivingAtk.spear,
                                atkLostSword: mov.sword - combatResult.survivingAtk.sword,
                                atkLostAxe: mov.axe - combatResult.survivingAtk.axe,
                                defSpear: reportDefSpear,
                                defSword: reportDefSword,
                                defAxe: reportDefAxe,
                                defLostSpear: reportDefLostSpear,
                                defLostSword: reportDefLostSword,
                                defLostAxe: reportDefLostAxe,
                                lootedWood,
                                lootedClay,
                                lootedIron
                            }
                        })

                        await tx.movement.update({
                            where: { id: mov.id },
                            data: { completed: true }
                        })
                        
                        console.log(`[COMBAT] Batalha concluída. Atacante venceu? ${combatResult.attackerWon}. Saque: ${lootedWood}`)

                    } else if (mov.type === 'SUPPORT') {
                        const existingSupport = await tx.supportingTroop.findFirst({
                            where: { ownerId: mov.originId, targetId: mov.targetId }
                        })

                        if (existingSupport) {
                            await tx.supportingTroop.update({
                                where: { id: existingSupport.id },
                                data: {
                                    spear: existingSupport.spear + mov.spear,
                                    sword: existingSupport.sword + mov.sword,
                                    axe: existingSupport.axe + mov.axe
                                }
                            })
                        } else {
                            await tx.supportingTroop.create({
                                data: {
                                    ownerId: mov.originId,
                                    targetId: mov.targetId,
                                    spear: mov.spear,
                                    sword: mov.sword,
                                    axe: mov.axe
                                }
                            })
                        }

                        await tx.movement.update({
                            where: { id: mov.id },
                            data: { completed: true }
                        })

                        console.log(`[COMBAT] Apoio de ${mov.originId} chegou em ${mov.targetId}.`)

                    } else if (mov.type === 'TRANSFER') {
                        // Transferência: As tropas passam a pertencer permanentemente à aldeia de destino
                        const targetUnits = await tx.villageUnit.findUnique({
                            where: { villageId: mov.targetId }
                        })

                        if (targetUnits) {
                            await tx.villageUnit.update({
                                where: { villageId: mov.targetId },
                                data: {
                                    spear: { increment: mov.spear },
                                    sword: { increment: mov.sword },
                                    axe: { increment: mov.axe }
                                }
                            })
                        } else {
                            await tx.villageUnit.create({
                                data: {
                                    villageId: mov.targetId,
                                    spear: mov.spear,
                                    sword: mov.sword,
                                    axe: mov.axe
                                }
                            })
                        }

                        await tx.movement.update({
                            where: { id: mov.id },
                            data: { completed: true }
                        })

                        console.log(`[COMBAT] Transferência de tropas de ${mov.originId} para ${mov.targetId} concluída.`)

                    } else if (mov.type === 'RETURN') {
                        // Sincroniza e consolida o estado da aldeia de origem até o momento da chegada das tropas (mov.arrivalTime)
                        const originVillage = await atualizarEstadoAldeia(tx, mov.targetId, mov.arrivalTime)

                        if (originVillage) {
                            if (originVillage.units) {
                                await tx.villageUnit.update({
                                    where: { villageId: originVillage.id },
                                    data: {
                                        spear: originVillage.units.spear + mov.spear,
                                        sword: originVillage.units.sword + mov.sword,
                                        axe: originVillage.units.axe + mov.axe
                                    }
                                })
                            }
                            
                            if (originVillage.resources && (mov.wood > 0 || mov.clay > 0 || mov.iron > 0)) {
                                const maxCap = getWarehouseCapacity(originVillage.buildings.warehouse)
                                await tx.villageResource.update({
                                    where: { villageId: originVillage.id },
                                    data: {
                                        wood: Math.min(maxCap, originVillage.resources.wood + mov.wood),
                                        clay: Math.min(maxCap, originVillage.resources.clay + mov.clay),
                                        iron: Math.min(maxCap, originVillage.resources.iron + mov.iron)
                                    }
                                })
                            }
                        }

                        await tx.movement.update({
                            where: { id: mov.id },
                            data: { completed: true }
                        })
                        
                        console.log(`[COMBAT] Tropas retornaram para ${mov.targetId}.`)
                    } else if (mov.type === 'TRANSPORT') {
                        // Sincroniza e consolida o estado do alvo até o momento da chegada
                        const targetUpdated = await atualizarEstadoAldeia(tx, mov.targetId, mov.arrivalTime)
                        
                        if (targetUpdated && targetUpdated.resources) {
                            const maxCap = getWarehouseCapacity(targetUpdated.buildings?.warehouse || 0)
                            
                            await tx.villageResource.update({
                                where: { villageId: mov.targetId },
                                data: {
                                    wood: Math.min(maxCap, targetUpdated.resources.wood + mov.wood),
                                    clay: Math.min(maxCap, targetUpdated.resources.clay + mov.clay),
                                    iron: Math.min(maxCap, targetUpdated.resources.iron + mov.iron)
                                }
                            })
                        }
                        
                        await tx.movement.update({
                            where: { id: mov.id },
                            data: { completed: true }
                        })
                        
                        const duration = mov.arrivalTime.getTime() - mov.startTime.getTime()
                        const returnTime = new Date(now.getTime() + duration)
                        
                        await tx.movement.create({
                            data: {
                                type: 'TRANSPORT_RETURN',
                                originId: mov.targetId,
                                targetId: mov.originId,
                                wood: mov.wood,
                                clay: mov.clay,
                                iron: mov.iron,
                                arrivalTime: returnTime
                            }
                        })
                        
                        console.log(`[COMBAT] Transporte de ${mov.originId} entregou recursos em ${mov.targetId}. Mercadores retornando...`)
                    } else if (mov.type === 'TRANSPORT_RETURN') {
                        await tx.movement.update({
                            where: { id: mov.id },
                            data: { completed: true }
                        })
                        console.log(`[COMBAT] Mercadores retornaram para ${mov.targetId}.`)
                    }
                })
            }
        } catch (e) {
            console.error('[COMBAT] Erro no combat loop', e)
        }
    }, 2000)
}
