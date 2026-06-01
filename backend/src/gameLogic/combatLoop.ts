import { getUnitStats } from './unitEconomy'

const calculateCombat = (atkUnits: any, defUnits: any) => {
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
                        const targetUnits = mov.target.units || { spear: 0, sword: 0, axe: 0 }
                        const supportTroops = mov.target.supportingReceived || []
                        
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
                        
                        const combatResult = calculateCombat(atkUnits, defUnits)
                        
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
                            
                            const targetRes = mov.target.resources
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

                            if (mov.target.userId === null) {
                                const newAttacks = mov.target.attacksReceived + 1
                                if (newAttacks >= 3) {
                                    const b = mov.target.buildings
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

                        if (!combatResult.attackerWon) {
                            reportDefSpear = -1
                            reportDefSword = -1
                            reportDefAxe = -1
                            reportDefLostSpear = -1
                            reportDefLostSword = -1
                            reportDefLostAxe = -1
                        }

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

                    } else if (mov.type === 'RETURN') {
                        const originVillage = await tx.village.findUnique({
                            where: { id: mov.targetId }, 
                            include: { units: true, resources: true }
                        })

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
                                await tx.villageResource.update({
                                    where: { villageId: originVillage.id },
                                    data: {
                                        wood: originVillage.resources.wood + mov.wood,
                                        clay: originVillage.resources.clay + mov.clay,
                                        iron: originVillage.resources.iron + mov.iron
                                    }
                                })
                            }
                        }

                        await tx.movement.update({
                            where: { id: mov.id },
                            data: { completed: true }
                        })
                        
                        console.log(`[COMBAT] Tropas retornaram para ${mov.targetId}.`)
                    }
                })
            }
        } catch (e) {
            console.error('[COMBAT] Erro no combat loop', e)
        }
    }, 2000)
}
